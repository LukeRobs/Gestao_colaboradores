const cron = require("node-cron");
const { exportarDailyWorks, exportarDailyWorksRecife } = require("../services/googleSheetsDailyWorks.service");
const logger = require("../utils/logger");

async function executarExportDailyWorks() {
  try {
    const resultado = await exportarDailyWorks();
    logger.info(`✅ [DAILY-WORKS-EXPORT] Concluído — ${JSON.stringify(resultado.data)}`);
  } catch (err) {
    logger.error(`❌ [DAILY-WORKS-EXPORT] Erro: ${err.message}`);
  }
}

async function executarExportDailyWorksRecife() {
  try {
    const resultado = await exportarDailyWorksRecife();
    logger.info(`✅ [DAILY-WORKS-EXPORT-RECIFE] Concluído — ${JSON.stringify(resultado.data)}`);
  } catch (err) {
    logger.error(`❌ [DAILY-WORKS-EXPORT-RECIFE] Erro: ${err.message}`);
  }
}

/**
 * Job: exporta o Daily Works do dia para o Google Sheets — Jaboatão e Recife.
 * Roda 3x ao dia — 08:00, 15:00 e 23:00 (horário de Brasília). As duas
 * exportações rodam no mesmo agendamento, cada uma com seu próprio try/catch
 * pra uma falha não bloquear a outra.
 */
function iniciarJobExportDailyWorks() {
  cron.schedule("0 8,15,23 * * *", executarExportDailyWorks, {
    timezone: "America/Sao_Paulo",
  });
  cron.schedule("0 8,15,23 * * *", executarExportDailyWorksRecife, {
    timezone: "America/Sao_Paulo",
  });

  logger.info("📊 [DAILY-WORKS-EXPORT] Jobs agendados (08:00, 15:00 e 23:00) — Jaboatão e Recife.");
}

module.exports = {
  iniciarJobExportDailyWorks,
  executarExportDailyWorks,
  executarExportDailyWorksRecife,
};
