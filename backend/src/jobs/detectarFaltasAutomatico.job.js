/**
 * Job: Detectar Faltas Automáticas
 *
 * Roda diariamente às 06:00 (após o T3 fechar às 05:00).
 * Processa o dia anterior e cria sugestões de MD para colaboradores
 * que deveriam ter trabalhado mas não têm registro.
 */

const cron = require("node-cron");
const { detectarFaltasAutomatico } = require("../services/detectarFaltasAutomatico.service");

function getDataOntem() {
  const agora = new Date();
  const spString = agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const dataBrasil = new Date(spString);
  dataBrasil.setDate(dataBrasil.getDate() - 1);
  return dataBrasil.toISOString().slice(0, 10);
}

function iniciarJobDetectarFaltas() {
  console.log("🤖 [JOB FALTAS] Agendando detecção automática de faltas — todos os dias às 06:00");

  cron.schedule(
    "0 6 * * *",
    async () => {
      const ontem = getDataOntem();
      console.log(`\n⏰ [JOB FALTAS] Executando para ${ontem}`);
      try {
        await detectarFaltasAutomatico(ontem, ontem);
      } catch (err) {
        console.error("❌ [JOB FALTAS] Erro:", err.message);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );

  console.log("✅ [JOB FALTAS] Agendado: todos os dias às 06:00 (America/Sao_Paulo)");
}

module.exports = { iniciarJobDetectarFaltas };
