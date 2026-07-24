/**
 * Job: Detectar Faltas Automáticas
 *
 * Expõe a função de backfill para reprocessar períodos históricos:
 *   - Manualmente, via endpoint administrativo (botão "Varrer faltas").
 *   - Automaticamente, 3x ao dia (06:00, 14:00, 22:00 — horário de Brasília),
 *     para invalidar sugestões pendentes cujo "F" tenha sido substituído por
 *     um atestado médico (AM) lançado depois, sem depender de clique manual.
 */

const cron = require("node-cron");
const { detectarFaltasAutomatico } = require("../services/detectarFaltasAutomatico.service");
const logger = require("../utils/logger");

function agoraBrasil() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/** Últimos 31 dias até hoje — mesma janela padrão do backfill manual. */
function getRangePadrao() {
  const hoje = agoraBrasil();
  const dataFim = hoje.toISOString().slice(0, 10);

  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 31);
  const dataInicio = inicio.toISOString().slice(0, 10);

  return { dataInicio, dataFim };
}

async function executarVarreduraFaltas() {
  const { dataInicio, dataFim } = getRangePadrao();
  logger.info(`⏰ [VARREDURA-FALTAS] Iniciando varredura automática (${dataInicio} → ${dataFim})`);

  try {
    // estacaoId=null → processa todas as estações
    const resultado = await detectarFaltasAutomatico(dataInicio, dataFim, null);
    logger.info(`✅ [VARREDURA-FALTAS] Concluída — ${JSON.stringify(resultado)}`);
  } catch (err) {
    logger.error(`❌ [VARREDURA-FALTAS] Erro: ${err.message}`);
  }
}

function iniciarJobVarrerFaltas() {
  // 3x ao dia: 06:00, 14:00 e 22:00 (horário de Brasília)
  cron.schedule("0 6,14,22 * * *", executarVarreduraFaltas, {
    timezone: "America/Sao_Paulo",
  });

  logger.info("🕵️  [VARREDURA-FALTAS] Job agendado (06:00, 14:00 e 22:00).");
}

module.exports = { detectarFaltasAutomatico, iniciarJobVarrerFaltas };
