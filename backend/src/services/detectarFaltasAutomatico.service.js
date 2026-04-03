/**
 * Service: Detectar Faltas Automáticas
 *
 * Varre colaboradores operacionais ativos e, para cada dia com frequência
 * de código "F" já registrada, dispara o detector de medida disciplinar.
 *
 * Regras:
 * - Só processa dias passados e o dia atual
 * - Ignora DSR, atestados, ausências administrativas, férias, afastamentos
 * - NÃO cria frequências novas — só processa "F" já existentes
 * - Idempotente: não duplica sugestões já existentes
 */

const { prisma } = require("../config/database");
const detectarViolacaoDisciplinar = require("./detectorMedidaDisciplinar");

const CARGOS_OPERACIONAIS = [
  "Auxiliar de Logística I",
  "Auxiliar de Logística II",
  "Auxiliar de Logística I - PCD",
  "Auxiliar de Returns I",
  "Auxilíar de Returns II",
  "Fiscal de pátio",
];

// Códigos que NÃO são falta (não geram sugestão) — mantido para referência
// O loop agora só processa "F" explicitamente, então este set não é mais usado no backfill

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function isDiaDSR(data, nomeEscala) {
  const dow = new Date(data).getDay();
  const dsrMap = {
    E: [0, 1],
    G: [2, 3],
    C: [4, 5],
    A: [0, 3],
    B: [1, 2],
  };
  const dias = dsrMap[String(nomeEscala || "").toUpperCase()];
  return !!dias?.includes(dow);
}

/**
 * Processa um intervalo de datas e cria faltas/sugestões para colaboradores
 * que deveriam ter trabalhado mas não têm registro.
 *
 * @param {string} dataInicio - YYYY-MM-DD
 * @param {string} dataFim    - YYYY-MM-DD (inclusive)
 * @returns {object} resumo da execução
 */
async function detectarFaltasAutomatico(dataInicio, dataFim) {
  const inicio = startOfDay(new Date(dataInicio));
  const fim = startOfDay(new Date(dataFim));

  console.log(`\n🔍 [DETECTOR FALTAS] Processando ${dataInicio} → ${dataFim}`);

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
    },
    include: {
      escala: true,
      ausencias: {
        where: {
          status: "ATIVO",
          dataInicio: { lte: fim },
          dataFim: { gte: inicio },
        },
        include: { tipoAusencia: true },
      },
      atestadosMedicos: {
        where: {
          status: "ATIVO",
          dataInicio: { lte: fim },
          dataFim: { gte: inicio },
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
      opsId: { in: opsIds },
      dataReferencia: { gte: inicio, lte: fim },
    },
    include: { tipoAusencia: true },
  });

  // Mapa: "opsId_YYYY-MM-DD" → frequência
  const freqMap = {};
  for (const f of frequenciasExistentes) {
    const key = `${f.opsId}_${ymd(f.dataReferencia)}`;
    // Prioriza manual
    if (!freqMap[key] || (f.manual && !freqMap[key].manual)) {
      freqMap[key] = f;
    }
  }

  /* =====================================================
     BUSCAR DATA DO PRIMEIRO ONBOARDING POR COLABORADOR
     — não utilizado neste fluxo, mantido para compatibilidade futura
  ===================================================== */
  const onboardings = await prisma.frequencia.findMany({
    where: {
      opsId: { in: opsIds },
      tipoAusencia: { codigo: "ON" },
    },
    select: { opsId: true, dataReferencia: true },
  });

  // onbMap: opsId → Date do primeiro ON (ou null se não tiver)
  const onbMap = {};
  for (const o of onboardings) {
    const d = startOfDay(o.dataReferencia);
    if (!onbMap[o.opsId] || d < onbMap[o.opsId]) {
      onbMap[o.opsId] = d;
    }
  }

  /* =====================================================
     ITERAR DIAS
  ===================================================== */
  let totalSugestoesCriadas = 0;
  let totalIgnorados = 0;

  const hoje = startOfDay(new Date());

  // Gerar lista de dias no intervalo
  const dias = [];
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    dias.push(new Date(d));
  }

  for (const colaborador of colaboradores) {
    for (const dia of dias) {
      // Nunca processar datas futuras
      if (dia > hoje) continue;

      const dataISO = ymd(dia);
      const key = `${colaborador.opsId}_${dataISO}`;

      /* ── DSR ── */
      const escalaNome = colaborador.escala?.nomeEscala;
      if (isDiaDSR(dia, escalaNome)) {
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

      try {
        await detectarViolacaoDisciplinar(freqExistente.idFrequencia);
        totalSugestoesCriadas++;
      } catch (e) {
        console.error(`⚠️ Detector falhou para ${colaborador.opsId} em ${dataISO}:`, e.message);
      }
    }
  }

  const resumo = {
    sucesso: true,
    periodo: { inicio: dataInicio, fim: dataFim },
    colaboradoresProcessados: colaboradores.length,
    sugestoesDisparadas: totalSugestoesCriadas,
    diasIgnorados: totalIgnorados,
  };

  console.log(`✅ [DETECTOR FALTAS] Concluído:`, resumo);
  return resumo;
}

module.exports = { detectarFaltasAutomatico };
