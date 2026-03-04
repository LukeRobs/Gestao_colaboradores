const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 🔄 Criar ou atualizar DW Real
 * Chave única: data + idTurno + idEmpresa
 */
const salvarDwReal = async ({ data, idTurno, idEmpresa, quantidade, observacao }) => {
  return prisma.dwReal.upsert({
    where: {
      data_idTurno_idEmpresa: {
        data: new Date(data),
        idTurno,
        idEmpresa
      }
    },
    update: {
      quantidade,
      observacao
    },
    create: {
      data: new Date(data),
      idTurno,
      idEmpresa,
      quantidade,
      observacao
    }
  });
};

/**
 * 📊 Listar DW Real por data + turno
 */
const listarDwRealPorTurno = async ({ data, idTurno }) => {
  return prisma.dwReal.findMany({
    where: {
      data: new Date(data),
      idTurno
    },
    include: {
      empresa: true
    },
    orderBy: {
      empresa: {
        razaoSocial: "asc"
      }
    }
  });
};

module.exports = {
  salvarDwReal,
  listarDwRealPorTurno
};
