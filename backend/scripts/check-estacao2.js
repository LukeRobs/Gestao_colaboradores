require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const e = await prisma.estacao.findUnique({
    where: { idEstacao: 2 },
    select: { idEstacao: true, nomeEstacao: true, sheetsMetaProducaoId: true },
  });
  console.log(e);
}

main().finally(() => prisma.$disconnect());
