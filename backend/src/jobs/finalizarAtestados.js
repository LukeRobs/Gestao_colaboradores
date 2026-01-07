// src/jobs/finalizarAtestados.job.js
const { prisma } = require("../config/database");

async function finalizarAtestados() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const result = await prisma.atestadoMedico.updateMany({
    where: {
      status: "ATIVO",
      dataFim: { lt: hoje }, // terminou ontem ou antes
    },
    data: {
      status: "FINALIZADO",
      dataFinalizacao: new Date(),
    },
  });

  console.log(
    `[CRON] Atestados finalizados automaticamente: ${result.count}`
  );
}

finalizarAtestados()
  .then(() => {
    console.log("[CRON] Job concluído com sucesso");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[CRON] Erro ao finalizar atestados:", err);
    process.exit(1);
  });
