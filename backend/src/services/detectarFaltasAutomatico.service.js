/**
 * Service: Detectar Faltas Automáticas
 *
 * Varre colaboradores operacionais ativos e, para cada dia sem registro
 * (ou com registro de falta não justificada), cria a frequência com código "F"
 * e dispara o detector de medida disciplinar.
 *
 * Regras:
 * - Só processa dias passados (não o dia atual em andamento)
 * - Ignora DSR, atestados, ausências administrativas, férias, afastamentos
 * - Dias em branco ("-") viram falta "F" e geram sugestão de MD
 * - Idempotente: não duplica frequências nem sugestões já existentes
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

// Códigos que NÃO são falta (não geram sugestão)
const CODIGOS_NAO_FALTA = new Set([
  "P", "DSR", "AM", "FE", "AFA", "BH", "S1", "FO",
  "LM", "LP", "AA", "TR", "DP", "DV", "DF", "FJ", "NC", "ON",
]);

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
  const tipoFalta = await prisma.tipoAusencia.findUnique({
    where: { codigo: "F" },
  });

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
     ITERAR DIAS
  ===================================================== */
  let totalFaltasCriadas = 0;
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
      // Nunca processar o dia atual (pode ainda estar em andamento)
      if (dia >= hoje) continue;

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

      /* ── Já tem frequência com código que não é falta ── */
      const freqExistente = freqMap[key];
      if (freqExistente) {
        const codigo = freqExistente.tipoAusencia?.codigo;
        if (CODIGOS_NAO_FALTA.has(codigo)) {
          totalIgnorados++;
          continue;
        }
        // Já tem frequência com código "F" → só dispara detector (pode não ter sugestão ainda)
        if (codigo === "F") {
          try {
            await detectarViolacaoDisciplinar(freqExistente.idFrequencia);
            totalSugestoesCriadas++;
          } catch (e) {
            console.error(`⚠️ Detector falhou para ${colaborador.opsId} em ${dataISO}:`, e.message);
          }
          continue;
        }
      }

      /* ── Dia em branco: criar frequência F e disparar detector ── */
      try {
        const novaFreq = await prisma.frequencia.upsert({
          where: {
            opsId_dataReferencia: {
              opsId: colaborador.opsId,
              dataReferencia: dia,
            },
          },
          update: {
            idTipoAusencia: tipoFalta.idTipoAusencia,
            manual: false,
            registradoPor: "SISTEMA_AUTO",
          },
          create: {
            opsId: colaborador.opsId,
            dataReferencia: dia,
            idTipoAusencia: tipoFalta.idTipoAusencia,
            manual: false,
            registradoPor: "SISTEMA_AUTO",
          },
        });

        totalFaltasCriadas++;

        await detectarViolacaoDisciplinar(novaFreq.idFrequencia);
        totalSugestoesCriadas++;

      } catch (e) {
        console.error(`⚠️ Erro ao processar ${colaborador.opsId} em ${dataISO}:`, e.message);
      }
    }
  }

  const resumo = {
    sucesso: true,
    periodo: { inicio: dataInicio, fim: dataFim },
    colaboradoresProcessados: colaboradores.length,
    faltasCriadas: totalFaltasCriadas,
    sugestoesDisparadas: totalSugestoesCriadas,
    diasIgnorados: totalIgnorados,
  };

  console.log(`✅ [DETECTOR FALTAS] Concluído:`, resumo);
  return resumo;
}

module.exports = { detectarFaltasAutomatico };
