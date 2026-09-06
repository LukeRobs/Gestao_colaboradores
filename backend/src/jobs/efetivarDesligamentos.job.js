const cron = require("node-cron");
const { prisma } = require("../config/database");
const logger = require("../utils/logger");

function agoraBrasil() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function startOfDayBR(date) {
  const d = date ? new Date(date) : agoraBrasil();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Efetiva (inativa) colaboradores cujo desligamento foi aprovado com data
 * futura (ex: aviso prévio) e essa data já chegou.
 *
 * Quando uma Solicitação Operacional de DESLIGAMENTO é aprovada com uma
 * `dataDesligamentoSolicitada` futura, o colaborador continua ATIVO (pra
 * não travar o ponto antes da hora) e só existe um registro em
 * `desligamento` marcando a data prevista, com `efetivadoEm: null`. Este
 * job varre só esses registros ainda pendentes e aplica o INATIVO no
 * colaborador exatamente no dia em que a data prevista chega, marcando o
 * registro como efetivado.
 *
 * Importante: o job NUNCA olha pra `colaborador.status` na hora de decidir
 * o que é "pendente" — só pra `efetivadoEm: null`. Isso é proposital: um
 * colaborador pode ter sido reativado manualmente depois de um desligamento
 * antigo (ex: desistência do desligamento, readmissão), e nesse caso o
 * registro antigo em `desligamento` não deve ser reaplicado. Todo histórico
 * anterior à migration que criou esta coluna já veio com `efetivadoEm`
 * preenchido via backfill — só desligamentos criados a partir de agora,
 * de fato pendentes, ficam com `efetivadoEm: null`.
 */
async function executarEfetivacaoDesligamentos() {
  logger.info("⏰ [DESLIGAMENTO-JOB] Verificando desligamentos agendados a efetivar...");
  try {
    const hoje = startOfDayBR();

    const pendentes = await prisma.desligamento.findMany({
      where: {
        efetivadoEm: null,
        dataDesligamento: { lte: hoje },
      },
      select: {
        id_desligamento: true,
        opsId: true,
        dataDesligamento: true,
        tipo: true,
        motivo: true,
      },
    });

    let efetivados = 0;
    let erros = 0;

    for (const d of pendentes) {
      try {
        await prisma.$transaction([
          prisma.colaborador.updateMany({
            where: { opsId: d.opsId, status: "ATIVO" },
            data: {
              status: "INATIVO",
              dataDesligamento: d.dataDesligamento,
              motivoDesligamento: d.motivo,
              tipoDesligamento: d.tipo,
            },
          }),
          prisma.desligamento.update({
            where: { id_desligamento: d.id_desligamento },
            data: { efetivadoEm: new Date() },
          }),
        ]);
        efetivados++;
      } catch (e) {
        erros++;
        logger.warn(`⚠️ [DESLIGAMENTO-JOB] Falha ao efetivar ${d.opsId}: ${e.message}`);
      }
    }

    logger.info(`✅ [DESLIGAMENTO-JOB] Concluído — ${efetivados} colaborador(es) efetivado(s), ${erros} erro(s).`);
  } catch (err) {
    logger.error("❌ [DESLIGAMENTO-JOB] Erro geral:", err.message);
  }
}

function iniciarJobEfetivarDesligamentos() {
  // Todo dia às 00:10 (America/Sao_Paulo) — logo após virar o dia
  cron.schedule("10 0 * * *", executarEfetivacaoDesligamentos, { timezone: "America/Sao_Paulo" });
  logger.info("🗓️  [DESLIGAMENTO-JOB] Job de efetivação de desligamentos agendados agendado (todo dia às 00:10).");
}

module.exports = { iniciarJobEfetivarDesligamentos, executarEfetivacaoDesligamentos };
