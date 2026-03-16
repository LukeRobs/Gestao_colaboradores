const cron = require("node-cron");
const {
  salvarProducaoColaboradorHistorico,
  verificarRegistroExistente,
} = require("../services/producaoColaboradorHistorico.service");

function getDataHoje() {
  const agora = new Date();
  const spString = agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(spString).toISOString().slice(0, 10);
}

function getDataOntem() {
  const agora = new Date();
  const spString = agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const d = new Date(spString);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function executar(turno, dataStr) {
  const jaExiste = await verificarRegistroExistente(turno, dataStr);
  if (jaExiste) {
    console.log(`ℹ️ [JOB COLAB ${turno}] Dados já existem, atualizando...`);
  }
  const resultado = await salvarProducaoColaboradorHistorico(turno, dataStr);
  if (resultado.success) {
    console.log(`✅ [JOB COLAB ${turno}] ${resultado.message} - ${resultado.registros} registros`);
  } else {
    console.error(`❌ [JOB COLAB ${turno}] Falha: ${resultado.message}`);
  }
}

function iniciarJobsProducaoColaborador() {
  console.log("\n🤖 [JOBS COLAB] Inicializando jobs de histórico por colaborador");

  // T1 às 15:00
  cron.schedule("0 15 * * *", async () => {
    console.log("\n⏰ [JOB COLAB T1] Salvando T1 às 15:00");
    await executar("T1", getDataHoje());
  }, { timezone: "America/Sao_Paulo" });

  // T2 às 23:00
  cron.schedule("0 23 * * *", async () => {
    console.log("\n⏰ [JOB COLAB T2] Salvando T2 às 23:00");
    await executar("T2", getDataHoje());
  }, { timezone: "America/Sao_Paulo" });

  // T3 às 05:00 (data de ontem)
  cron.schedule("0 5 * * *", async () => {
    console.log("\n⏰ [JOB COLAB T3] Salvando T3 às 05:00");
    await executar("T3", getDataOntem());
  }, { timezone: "America/Sao_Paulo" });

  console.log("✅ [JOBS COLAB] Jobs agendados:");
  console.log("   📌 T1: 15:00 | T2: 23:00 | T3: 05:00");
  console.log("   🌎 Timezone: America/Sao_Paulo\n");
}

module.exports = { iniciarJobsProducaoColaborador };
