const cron = require("node-cron");
const { liberarDocasSemVeiculo, MINUTOS_SEM_VEICULO } = require("../services/mapaOperacional/docaAutoLiberacao.service");

/** A cada minuto: desatrela das docas as equipes que ficaram sem veículo (ver o serviço). */
function iniciarJobLiberarDocasSemVeiculo() {
  async function executar() {
    try {
      const { liberadas } = await liberarDocasSemVeiculo();
      if (liberadas > 0) console.log(`🚚 [DOCAS] ${liberadas} doca(s) liberada(s) automaticamente (sem veículo)`);
    } catch (err) {
      console.error("❌ [DOCAS] Erro na liberação automática:", err.message);
    }
  }

  executar();
  cron.schedule("*/1 * * * *", executar);
  console.log(`✅ [DOCAS] Liberação automática agendada (a cada 1 minuto, após ${MINUTOS_SEM_VEICULO} min sem veículo)`);
}

module.exports = { iniciarJobLiberarDocasSemVeiculo };
