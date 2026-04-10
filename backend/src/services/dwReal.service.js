const { prisma } = require('../config/database');

/**
 * 🔄 Criar ou atualizar DW Real
 * Chave única: data + idTurno + idEmpresa + idEstacao
 * Nota: upsert não funciona com NULL em unique constraint no PostgreSQL,
 * por isso usamos findFirst + update/create manualmente.
 */
const salvarDwReal = async ({ data, idTurno, idEmpresa, idEstacao, quantidade, observacao }) => {
  const dataDate = new Date(data);
  const estacao = idEstacao ? Number(idEstacao) : null;

  const existing = await prisma.dwReal.findFirst({
    where: {
      data: dataDate,
      idTurno,
      idEmpresa,
      idEstacao: estacao
    }
  });

  if (existing) {
    return prisma.dwReal.update({
      where: { id: existing.id },
      data: { quantidade, observacao }
    });
  }

  return prisma.dwReal.create({
    data: {
      data: dataDate,
      idTurno,
      idEmpresa,
      idEstacao: estacao,
      quantidade,
      observacao
    }
  });
};

/**
 * 📊 Listar DW Real por data + turno (+ estacao opcional)
 */
const listarDwRealPorTurno = async ({ data, idTurno, idEstacao }) => {
  const where = {
    data: new Date(data),
    idTurno
  };

  if (idEstacao) {
    where.OR = [
      { idEstacao: Number(idEstacao) },
      { idEstacao: null }
    ];
  }

  return prisma.dwReal.findMany({
    where,
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
