const { prisma } = require("../config/database");

/* =====================================================
   HELPERS
===================================================== */

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function subtractDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/* =====================================================
   RESOLVER PROGRESSÃO DISCIPLINAR

   Retorna:
     { bloqueado: true }
       → 4+ dias consecutivos: NÃO aplicar automação,
         encaminhar para análise manual do RH.

     { bloqueado: false, numOcorrencia: N, matriz: MatrizRecord }
       → N é o número desta ocorrência (1, 2, 3, …)
         Matriz é a entrada correta para esse nível.

   Progressão padrão (1 ocorrência = 1 medida ativa no histórico):
     0 anteriores → 1ª ocorrência → PRIMEIRA_OCORRENCIA na matriz
     1 anterior   → 2ª ocorrência → REINCIDENCIA, menor diasSuspensao (1d)
     2+ anteriores → 3ª+ ocorrência → REINCIDENCIA, maior diasSuspensao (3d)

   A matriz pode ter múltiplas entradas REINCIDENCIA com diasSuspensao
   diferentes (ex.: 1d e 3d). O código ordena por diasSuspensao ASC e
   seleciona o índice correto para cada degrau.
===================================================== */

async function resolverProgressaoDisciplinar(opsId, diasConsecutivos) {
  /* ── 4+ dias → bloqueio para análise manual do RH ── */
  if (diasConsecutivos >= 4) {
    return { bloqueado: true };
  }

  /* ── Contar ocorrências anteriores ── */
  const result = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM medida_disciplinar
    WHERE ops_id      = ${opsId}
      AND violacao    = 'FALTA_INJUSTIFICADA'
      AND status::text <> 'CANCELADA'
  `;
  const anteriores  = result[0]?.count ?? 0;
  const numOcorrencia = anteriores + 1;

  /* ── Buscar entrada correta na matriz ── */
  let matriz = null;

  if (numOcorrencia === 1) {
    // 1ª ocorrência
    matriz = await prisma.matrizMedidaDisciplinar.findFirst({
      where: { violacao: "FALTA_INJUSTIFICADA", frequencia: "PRIMEIRA_OCORRENCIA" },
    });
  } else {
    // 2ª ou 3ª+ ocorrência: pegar TODAS as entradas REINCIDENCIA e selecionar por degrau
    // Ordenadas por diasSuspensao ASC:
    //   2ª → índice 0  (menor suspensão, ex.: 1d)
    //   3ª+ → índice -1 (maior suspensão, ex.: 3d)
    const reincidencias = await prisma.matrizMedidaDisciplinar.findMany({
      where: { violacao: "FALTA_INJUSTIFICADA", frequencia: "REINCIDENCIA" },
      orderBy: { diasSuspensao: "asc" },
    });

    if (reincidencias.length > 0) {
      if (numOcorrencia === 2) {
        matriz = reincidencias[0]; // menor suspensão → 2ª
      } else {
        matriz = reincidencias[reincidencias.length - 1]; // maior suspensão → 3ª+
      }
    }
  }

  // Fallback: qualquer entrada para esta violação
  if (!matriz) {
    matriz = await prisma.matrizMedidaDisciplinar.findFirst({
      where: { violacao: "FALTA_INJUSTIFICADA" },
    });
  }

  return { bloqueado: false, numOcorrencia, matriz };
}

/* =====================================================
   BUSCA MD MANUAL ATIVA
===================================================== */

async function getMdManualAtiva(opsId) {
  const md = await prisma.medidaDisciplinar.findFirst({
    where: { opsId, violacao: "FALTA_INJUSTIFICADA", origem: "MANUAL" },
  });
  if (!md) return null;

  const res = await prisma.$queryRaw`
    SELECT id_medida FROM medida_disciplinar
    WHERE ops_id = ${opsId}
      AND violacao = 'FALTA_INJUSTIFICADA'
      AND origem   = 'MANUAL'
      AND status::text <> 'CANCELADA'
    LIMIT 1
  `;
  return res.length > 0 ? md : null;
}

/* =====================================================
   DETECTAR VIOLAÇÃO — SEQUÊNCIA  (LÓGICA PRINCIPAL)

   Recebe uma sequência de faltas consecutivas e cria UMA
   única sugestão de medida disciplinar para o grupo.

   Parâmetros:
     sequencia  : Array<{ data: "YYYY-MM-DD", idFrequencia: number }>
                  ordenado por data ASC
     opsId      : string
     idTipoFalta: number — id do tipoAusencia com codigo "F"
===================================================== */

async function detectarViolacaoSequencia(sequencia, opsId, idTipoFalta) {
  try {
    const diasConsecutivos = sequencia.length;
    const primeiro         = sequencia[0];

    /* ──────────────────────────────────────────────────
       VERIFICAR SE É CONTINUAÇÃO DE SEQUÊNCIA ANTERIOR
       Ao re-processar uma janela, a sequência pode ser
       o "rabo" de uma série que já começou antes do
       dataInicio do backfill. Nesse caso ignoramos.
    ────────────────────────────────────────────────── */
    const diaAnteriorStr   = subtractDays(primeiro.data, 1);
    const diaAnteriorStart = new Date(`${diaAnteriorStr}T00:00:00`);
    const diaAnteriorEnd   = new Date(`${diaAnteriorStr}T23:59:59`);

    const faltaDiaAnterior = await prisma.frequencia.findFirst({
      where: {
        opsId,
        dataReferencia: { gte: diaAnteriorStart, lte: diaAnteriorEnd },
        idTipoAusencia: idTipoFalta,
      },
    });

    if (faltaDiaAnterior) {
      return false; // continuação — já tratada na janela anterior
    }

    /* ──────────────────────────────────────────────────
       IDEMPOTÊNCIA
       Se qualquer frequência da sequência já tem sugestão
       vinculada → esta sequência já foi processada.
    ────────────────────────────────────────────────── */
    const idsFrequencia = sequencia.map((s) => s.idFrequencia);

    const jaExiste = await prisma.sugestaoMedidaDisciplinar.findFirst({
      where: { idFrequencia: { in: idsFrequencia } },
    });

    if (jaExiste) {
      return false;
    }

    /* ──────────────────────────────────────────────────
       RESOLVER PROGRESSÃO DISCIPLINAR
       4+ dias → bloqueio para análise manual do RH.
       1-3 dias → progressão por número de ocorrências.
    ────────────────────────────────────────────────── */
    const progressao = await resolverProgressaoDisciplinar(opsId, diasConsecutivos);

    /* ──────────────────────────────────────────────────
       CASO: 4+ DIAS CONSECUTIVOS
       Criamos sugestão sinalizada para análise do RH.
       Consequencia = DESLIGAMENTO_ANALISE_JURIDICA como
       flag (não indica demissão; sinaliza revisão manual).
    ────────────────────────────────────────────────── */
    if (progressao.bloqueado) {
      await prisma.sugestaoMedidaDisciplinar.create({
        data: {
          opsId,
          idFrequencia:    primeiro.idFrequencia,
          dataReferencia:  new Date(`${primeiro.data}T00:00:00`),
          violacao:        "FALTA_INJUSTIFICADA",
          consequencia:    "DESLIGAMENTO_ANALISE_JURIDICA",
          diasSuspensao:   null,
          diasConsecutivos,
          status:          "PENDENTE",
        },
      });
      console.log(
        `🚨 Sugestão p/ análise manual RH criada: ${opsId} ` +
        `em ${primeiro.data} — ${diasConsecutivos} dias consecutivos`
      );
      return true;
    }

    /* ──────────────────────────────────────────────────
       CASO: 1-3 DIAS — progressão normal
    ────────────────────────────────────────────────── */
    const { numOcorrencia, matriz } = progressao;

    if (!matriz) {
      console.log("⚠️ Matriz disciplinar não encontrada para FALTA_INJUSTIFICADA — sugestão não criada");
      return false;
    }

    /* ── Verificar MD manual ativa ── */
    const mdManualExistente = await getMdManualAtiva(opsId);

    const statusSugestao = mdManualExistente ? "REJEITADA" : "PENDENTE";
    const aprovadoPor    = mdManualExistente ? "SISTEMA — MD manual já registrada" : null;

    /* ── Criar sugestão ── */
    await prisma.sugestaoMedidaDisciplinar.create({
      data: {
        opsId,
        idFrequencia:    primeiro.idFrequencia,
        dataReferencia:  new Date(`${primeiro.data}T00:00:00`),
        violacao:        "FALTA_INJUSTIFICADA",
        consequencia:    matriz.consequencia,
        diasSuspensao:   matriz.diasSuspensao,
        diasConsecutivos,
        status:          statusSugestao,
        ...(aprovadoPor && { aprovadoPor }),
      },
    });

    const diasLabel = diasConsecutivos > 1
      ? ` (${diasConsecutivos} dias consecutivos)`
      : "";

    if (mdManualExistente) {
      console.log(`⚠️ Sugestão REJEITADA (MD manual) — ${opsId}${diasLabel}`);
    } else {
      console.log(
        `✅ Sugestão criada para ${opsId} em ${primeiro.data}${diasLabel} ` +
        `[${numOcorrencia}ª ocorrência — ${matriz.consequencia}]`
      );
    }

    return true;

  } catch (error) {
    console.error("❌ detectarViolacaoSequencia:", error);
    throw error;
  }
}

/* =====================================================
   DETECTAR VIOLAÇÃO — FREQUÊNCIA AVULSA (LEGADO)
   Mantida para compatibilidade / uso manual pontual.
===================================================== */

async function detectarViolacaoDisciplinar(idFrequencia) {
  try {
    const frequencia = await prisma.frequencia.findUnique({
      where: { idFrequencia: parseInt(idFrequencia) },
      include: { tipoAusencia: true },
    });

    if (!frequencia || frequencia.tipoAusencia?.codigo !== "F") return;

    const tipoFalta = await prisma.tipoAusencia.findUnique({ where: { codigo: "F" } });
    if (!tipoFalta) return;

    await detectarViolacaoSequencia(
      [{ data: ymd(frequencia.dataReferencia), idFrequencia: frequencia.idFrequencia }],
      frequencia.opsId,
      tipoFalta.idTipoAusencia
    );
  } catch (error) {
    console.error("❌ detectorMedidaDisciplinar:", error);
  }
}

module.exports = detectarViolacaoDisciplinar;
module.exports.detectarViolacaoSequencia     = detectarViolacaoSequencia;
module.exports.resolverProgressaoDisciplinar = resolverProgressaoDisciplinar;
