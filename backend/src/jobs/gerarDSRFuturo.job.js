const cron = require("node-cron");
const { prisma } = require("../config/database");
const { gerarDSRFuturoColaborador } = require("../services/dsrBackfill.service");
const logger = require("../utils/logger");

/**
 * Job: gera DSR futuros (90 dias) para todos os colaboradores ativos.
 * Roda toda segunda-feira às 03:00 (horário de Brasília).
 * O skipDuplicates no service garante que não duplica registros já existentes.
 */
async function executarGeracaoDSRFuturo() {
  logger.info("⏰ [DSR-JOB] Iniciando geração de DSR futuros...");

  try {
    const colaboradores = await prisma.colaborador.findMany({
      where: { status: { in: ["ATIVO", "FERIAS", "AFASTADO"] } },
      select: {
        opsId: true,
        idEstacao: true,
        escala: { select: { nomeEscala: true } },
      },
    });

    let criados = 0;
    let erros = 0;

    for (const c of colaboradores) {
      const nomeEscala = c.escala?.nomeEscala;
      if (!nomeEscala) continue;
      try {
        await gerarDSRFuturoColaborador({ opsId: c.opsId, nomeEscala, dias: 90, idEstacao: c.idEstacao ?? null });
        criados++;
      } catch (e) {
        erros++;
        logger.warn(`⚠️ [DSR-JOB] Falha em ${c.opsId}: ${e.message}`);
      }
    }

    logger.info(`✅ [DSR-JOB] Concluído — ${criados} colaboradores processados, ${erros} erros.`);
  } catch (err) {
    logger.error("❌ [DSR-JOB] Erro geral:", err.message);
  }
}

function iniciarJobDSRFuturo() {
  // Toda segunda-feira às 03:00
  cron.schedule("0 3 * * 1", executarGeracaoDSRFuturo, {
    timezone: "America/Sao_Paulo",
  });

  logger.info("🗓️  [DSR-JOB] Job de DSR futuro agendado (toda segunda às 03:00).");
}

module.exports = { iniciarJobDSRFuturo };
