const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getEscalaDoDia(opsId, data) {
  return prisma.colaboradorEscalaHistorico.findFirst({
    where: {
      opsId,
      dataInicio: { lte: data },
      OR: [
        { dataFim: null },
        { dataFim: { gte: data } }
      ]
    },
    include: {
      escala: true
    }
  });
}

module.exports = { getEscalaDoDia };