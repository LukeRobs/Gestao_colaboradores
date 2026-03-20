const { prisma } = require("../config/database");

function buildWhere({ inicio, fim, empresa, turno, setor, lider }) {
  const where = {
    dataDesligamento: {
      not: null,
    },
  };

  if (inicio && fim) {
    where.dataDesligamento = {
      not: null,
      gte: new Date(inicio),
      lt: new Date(new Date(fim).getTime() + 86400000),
    };
  }

  if (empresa) where.idEmpresa = Number(empresa);
  if (turno) {
    const turnoMap = {
        T1: 1,
        T2: 2,
        T3: 3,
    };

    const turnoId = turnoMap[turno];

    if (turnoId) {
        where.idTurno = turnoId;
    }
    }
  if (setor) where.idSetor = Number(setor);
  if (lider) where.idLider = lider;

  return where;
}

async function getDesligamentosDashboard(params) {
  const where = buildWhere(params);

  console.log("📊 WHERE:", JSON.stringify(where, null, 2));

  const data = await prisma.colaborador.findMany({
    where,
    select: {
      opsId: true,
      nomeCompleto: true,
      genero: true,

      dataAdmissao: true,
      dataDesligamento: true,

      motivoDesligamento: true, // ✅ ENUM
      tipoDesligamento: true,   // ✅ ENUM

      empresa: {
        select: {
          idEmpresa: true,
          razaoSocial: true,
        },
      },
      setor: {
        select: {
          idSetor: true,
          nomeSetor: true,
        },
      },
      turno: {
        select: {
          idTurno: true,
          nomeTurno: true,
        },
      },
      lider: {
        select: {
          opsId: true,
          nomeCompleto: true,
        },
      },
    },
    orderBy: {
      dataDesligamento: "desc",
    },
  });

  console.log("📊 TOTAL REGISTROS:", data.length);

  return data;
}

module.exports = {
  getDesligamentosDashboard,
};