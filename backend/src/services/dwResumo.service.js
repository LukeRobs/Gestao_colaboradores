const { buscarDwPlanejado } = require('./googleSheetsDW.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const buscarDwResumo = async ({ data, idTurno }) => {
  // 1️⃣ Planejado (Sheets)
  const turnoMap = {
    1: 'T1',
    2: 'T2',
    3: 'T3'
  };

  const planejadoResult = await buscarDwPlanejado(
    turnoMap[idTurno],
    data
  );

  const dwPlanejado = planejadoResult.data.dwPlanejado;

  // 2️⃣ Real (Banco)
  const dwReais = await prisma.dwReal.findMany({
    where: {
      data: new Date(data),
      idTurno
    },
    include: {
      empresa: true
    },
    orderBy: {
      empresa: { nome: 'asc' }
    }
  });

  const totalReal = dwReais.reduce(
    (sum, r) => sum + r.quantidade,
    0
  );

  // 3️⃣ Diferença
  const diferenca = totalReal - dwPlanejado;

  return {
    data,
    idTurno,
    planejado: dwPlanejado,
    real: totalReal,
    diferenca,
    empresas: dwReais.map(r => ({
      idEmpresa: r.idEmpresa,
      empresa: r.empresa.nome,
      quantidade: r.quantidade,
      observacao: r.observacao
    }))
  };
};

module.exports = {
  buscarDwResumo
};
