const cron = require("node-cron");
const { ativarAgendadasVencidas } = require("../services/mapaOperacional/alocacaoAgendada.service");

/** A cada minuto: pré-alocações cujo turno começou viram alocações reais. */
function iniciarJobAlocacoesAgendadas() {
  async function executar() {
    try {
      const { ativadas } = await ativarAgendadasVencidas();
      if (ativadas > 0) console.log(`🗓️ [AGENDADAS] ${ativadas} pré-alocação(ões) processada(s) no início do turno`);
    } catch (err) {
      console.error("❌ [AGENDADAS] Erro ao ativar pré-alocações:", err.message);
    }
  }

  executar();
  cron.schedule("*/1 * * * *", executar);
  console.log("✅ [AGENDADAS] Ativação de pré-alocações agendada (a cada 1 minuto)");
}

module.exports = { iniciarJobAlocacoesAgendadas };
