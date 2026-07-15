const { prisma } = require("../config/database");
const {
  PRODUCAO_ONTIME_SHEET_PRIMARY,
  PRODUCAO_ONTIME_SHEET_BACKUP,
} = require("./googleSheetsMetaProducao.service");

const CONFIG_ID = 1;

async function obterConfigFonteProducao() {
  return prisma.fonteProducaoConfig.findUnique({ where: { id: CONFIG_ID } });
}

async function obterFonteProducaoAtiva() {
  const config = await obterConfigFonteProducao();
  return config?.fonte === "BACKUP" ? "BACKUP" : "PRIMARY";
}

function fonteParaNomeAba(fonte) {
  return fonte === "BACKUP" ? PRODUCAO_ONTIME_SHEET_BACKUP : PRODUCAO_ONTIME_SHEET_PRIMARY;
}

async function definirFonteProducao(fonte, usuario) {
  return prisma.fonteProducaoConfig.upsert({
    where: { id: CONFIG_ID },
    update: {
      fonte,
      atualizadoPorId: usuario?.id ?? null,
      atualizadoPorNome: usuario?.name ?? null,
    },
    create: {
      id: CONFIG_ID,
      fonte,
      atualizadoPorId: usuario?.id ?? null,
      atualizadoPorNome: usuario?.name ?? null,
    },
  });
}

module.exports = {
  obterConfigFonteProducao,
  obterFonteProducaoAtiva,
  fonteParaNomeAba,
  definirFonteProducao,
};
