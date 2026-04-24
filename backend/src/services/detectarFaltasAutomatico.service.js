/**
 * Service: Detectar Faltas Automáticas
 *
 * Varre colaboradores operacionais ativos e, para cada sequência de dias com
 * frequência de código "F" já registrada, dispara UMA sugestão de medida
 * disciplinar por sequência consecutiva.
 *
 * Regras:
 * - Só processa dias passados e o dia atual
 * - Ignora DSR, atestados, ausências administrativas, férias, afastamentos
 * - NÃO cria frequências novas — só processa "F" já existentes
 * - Idempotente: não duplica sugestões já existentes
 * - Faltas em dias consecutivos de calendário geram UMA única sugestão
 * - Sequências > 3 dias → agravamento automático (REINCIDENCIA na matriz)
 */

const { prisma } = require("../config/database");
const { detectarViolacaoSequencia } = require("./detectorMedidaDisciplinar");
const { isDiaDSRSync } = require("../utils/dsr");

const CARGOS_OPERACIONAIS = [
  "Auxiliar de Logística I",
  "Auxiliar de Logística II",
  "Auxiliar de Logística I - PCD",
  "Auxiliar de Returns I",
  "Auxilíar de Returns II",
  "Fiscal de pátio",
];

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Agrupa um array de faltas `{ data: "YYYY-MM-DD", idFrequencia }` em
 * sequências de dias calendário consecutivos.
 *
 * Exemplo:
 *   ["04-01", "04-02", "04-05", "04-06", "04-07"]
 *   → [[04-01, 04-02], [04-05, 04-06, 04-07]]
 *
 * "Consecutivo" = gap de exatamente 1 dia de calendário.
 * Uma presença (P) ou qualquer outro status que NÃO seja "F" no dia N
 * já interrompe a sequência naturalmente, pois aquele dia nunca entra
 * na lista de faltas.
 */
function agruparConsecutivas(faltas) {
  if (!faltas.length) return [];

  // Ordenar por data ASC (já deve estar, mas garantir)
  const sorted = [...faltas].sort((a, b) => a.data.localeCompare(b.data));

  const sequencias = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const grupo = sequencias[sequencias.length - 1];
    const ultimaData = grupo[grupo.length - 1].data;
    const dataAtual  = sorted[i].data;

    const prev = new Date(`${ultimaData}T00:00:00`);
    const curr = new Date(`${dataAtual}T00:00:00`);
    const diffDays = Math.round((curr - prev) / 86400000);

    if (diffDays === 1) {
      grupo.push(sorted[i]);
    } else {
      sequencias.push([sorted[i]]);
    }
  }

  return sequencias;
}

/**
 * Processa um intervalo de datas e cria sugestões para colaboradores que
 * possuem frequência "F" — agrupando faltas consecutivas numa única sugestão.
 *
 * @param {string} dataInicio - YYYY-MM-DD
 * @param {string} dataFim    - YYYY-MM-DD (inclusive)
 * @param {number|null} estacaoId
 * @returns {object} resumo da execução
 */
async function detectarFaltasAutomatico(dataInicio, dataFim, estacaoId = null) {
  const inicio = startOfDay(new Date(dataInicio));
  const fim    = startOfDay(new Date(dataFim));

  console.log(
    `\n🔍 [DETECTOR FALTAS] Processando ${dataInicio} → ${dataFim}` +
    (estacaoId ? ` | estação ${estacaoId}` : " | todas as estações")
  );

  /* =====================================================
     BUSCAR TIPO "F"
  ===================================================== */
  const tipoFalta = await prisma.tipoAusencia.findUnique({ where: { codigo: "F" } });

  if (!tipoFalta) {
    console.error("❌ Tipo de ausência 'F' não encontrado no banco");
    return { sucesso: false, erro: "Tipo F não encontrado" };
  }

  /* =====================================================
     BUSCAR COLABORADORES OPERACIONAIS ATIVOS
  ===================================================== */
  const colaboradores = await prisma.colaborador.findMany({
    where: {
      status: "ATIVO",
      dataDesligamento: null,
      cargo: { nomeCargo: { in: CARGOS_OPERACIONAIS } },
      ...(estacaoId ? { idEstacao: estacaoId } : {}),
    },
    include: {
      escala: true,
      ausencias: {
        where: {
          status: "ATIVO",
          dataInicio: { lte: fim },
          dataFim:    { gte: inicio },
        },
        include: { tipoAusencia: true },
      },
      atestadosMedicos: {
        where: {
          status: "ATIVO",
          dataInicio: { lte: fim },
          dataFim:    { gte: inicio },
        },
      },
    },
  });

  console.log(`👥 Colaboradores operacionais: ${colaboradores.length}`);

  /* =====================================================
     BUSCAR FREQUÊNCIAS JÁ EXISTENTES NO PERÍODO
  ===================================================== */
  const opsIds = colaboradores.map((c) => c.opsId);

  const frequenciasExistentes = await prisma.frequencia.findMany({
    where: {
      opsId:         { in: opsIds },
      dataReferencia: { gte: inicio, lte: fim },
    },
    include: { tipoAusencia: true },
  });

  // Mapa: "opsId_YYYY-MM-DD" → frequência (prioriza manual)
  const freqMap = {};
  for (const f of frequenciasExistentes) {
    const key = `${f.opsId}_${ymd(f.dataReferencia)}`;
    if (!freqMap[key] || (f.manual && !freqMap[key].manual)) {
      freqMap[key] = f;
    }
  }

  /* =====================================================
     INVALIDAR SUGESTÕES PENDENTES CUJO "F" FOI ALTERADO
  ===================================================== */
  const sugestoesPendentes = await prisma.sugestaoMedidaDisciplinar.findMany({
    where: {
      status:      "PENDENTE",
      idFrequencia: { not: null },
    },
    include: {
      frequencia: { include: { tipoAusencia: true } },
    },
  });

  let totalInvalidadas = 0;
  for (const sugestao of sugestoesPendentes) {
    const codigoAtual = sugestao.frequencia?.tipoAusencia?.codigo;
    if (codigoAtual !== "F") {
      await prisma.sugestaoMedidaDisciplinar.update({
        where: { idSugestao: sugestao.idSugestao },
        data:  { status: "REJEITADA" },
      });
      totalInvalidadas++;
      console.log(`🗑️ Sugestão ${sugestao.idSugestao} invalidada (F → ${codigoAtual ?? "sem tipo"})`);
    }
  }

  if (totalInvalidadas > 0) {
    console.log(`⚠️ [DETECTOR FALTAS] ${totalInvalidadas} sugestão(ões) invalidada(s)`);
  }

  /* =====================================================
     GERAR LISTA DE DIAS NO INTERVALO
  ===================================================== */
  const hoje = startOfDay(new Date());

  const dias = [];
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    dias.push(ymd(new Date(d)));
  }

  /* =====================================================
     PROCESSAR CADA COLABORADOR
     1. Coletar todos os dias com falta "F" no período
     2. Agrupar em sequências consecutivas de calendário
     3. Criar UMA sugestão por sequência
  ===================================================== */
  let totalSugestoesCriadas = 0;
  let totalIgnorados        = 0;

  for (const colaborador of colaboradores) {
    const faltasDoColaborador = []; // { data, idFrequencia }

    for (const dataISO of dias) {
      const dia = new Date(`${dataISO}T00:00:00`);

      // Nunca processar datas futuras
      if (dia > hoje) continue;

      const key = `${colaborador.opsId}_${dataISO}`;

      /* ── DSR ── */
      const diasDsr = colaborador.escala?.diasDsr || [];
      if (isDiaDSRSync(dia, diasDsr)) {
        totalIgnorados++;
        continue;
      }

      /* ── Atestado médico ── */
      const temAtestado = colaborador.atestadosMedicos?.some(
        (a) => dia >= startOfDay(a.dataInicio) && dia <= startOfDay(a.dataFim)
      );
      if (temAtestado) {
        totalIgnorados++;
        continue;
      }

      /* ── Ausência administrativa ── */
      const ausencia = colaborador.ausencias?.find(
        (a) => dia >= startOfDay(a.dataInicio) && dia <= startOfDay(a.dataFim)
      );
      if (ausencia) {
        totalIgnorados++;
        continue;
      }

      /* ── Só processa se já tem frequência com código "F" ── */
      const freqExistente = freqMap[key];
      if (!freqExistente || freqExistente.tipoAusencia?.codigo !== "F") {
        totalIgnorados++;
        continue;
      }

      // ✅ Dia válido com falta — adicionar à lista do colaborador
      faltasDoColaborador.push({
        data:         dataISO,
        idFrequencia: freqExistente.idFrequencia,
      });
    }

    if (!faltasDoColaborador.length) continue;

    /* ── Agrupar faltas consecutivas ── */
    const sequencias = agruparConsecutivas(faltasDoColaborador);

    for (const sequencia of sequencias) {
      const diasStr = sequencia.length > 1
        ? ` [${sequencia.length} dias: ${sequencia.map((s) => s.data).join(", ")}]`
        : ` [${sequencia[0].data}]`;

      try {
        const criou = await detectarViolacaoSequencia(
          sequencia,
          colaborador.opsId,
          tipoFalta.idTipoAusencia
        );
        if (criou) {
          totalSugestoesCriadas++;
          if (sequencia.length > 1) {
            console.log(
              `📋 Sugestão agrupada para ${colaborador.opsId}${diasStr}`
            );
          }
        }
      } catch (e) {
        console.error(
          `⚠️ Detector falhou para ${colaborador.opsId}${diasStr}:`,
          e.message
        );
      }
    }
  }

  const resumo = {
    sucesso: true,
    periodo: { inicio: dataInicio, fim: dataFim },
    colaboradoresProcessados: colaboradores.length,
    sugestoesDisparadas:      totalSugestoesCriadas,
    sugestoesInvalidadas:     totalInvalidadas,
    diasIgnorados:            totalIgnorados,
  };

  console.log(`✅ [DETECTOR FALTAS] Concluído:`, resumo);
  return resumo;
}

module.exports = { detectarFaltasAutomatico };
