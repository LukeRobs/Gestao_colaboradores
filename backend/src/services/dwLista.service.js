const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { buscarDwPlanejado } = require("./googleSheetsDW.service");

/* ==========================
   EMPRESAS FIXAS DO DW
========================== */
const EMPRESAS_FIXAS = {
  12: "SRM",
  13: "Fenix",
  14: "Horeca",
};

const IDS_EMPRESAS_FIXAS = Object.keys(EMPRESAS_FIXAS).map(Number);

const buscarDwLista = async ({ data, idTurno, idEmpresa }) => {
  /* ==========================
     1️⃣ BUSCAR DW REAL
  ========================== */
  const where = {
    idEmpresa: { in: IDS_EMPRESAS_FIXAS }, // 🔒 apenas SRM / Fenix / Horeca
  };

  if (data) where.data = new Date(data);
  if (idTurno) where.idTurno = Number(idTurno);

  // se filtrar por empresa, valida se é uma das 3
  if (idEmpresa && IDS_EMPRESAS_FIXAS.includes(Number(idEmpresa))) {
    where.idEmpresa = Number(idEmpresa);
  }

  const dwReais = await prisma.dwReal.findMany({
    where,
    orderBy: [
      { data: "desc" },
      { idTurno: "asc" },
    ],
  });

  /* ==========================
     2️⃣ AGRUPAR POR DATA + TURNO
  ========================== */
  const agrupado = {};
  const turnoMap = { 1: "T1", 2: "T2", 3: "T3" };

  for (const r of dwReais) {
    const dataISO = r.data.toISOString().slice(0, 10);
    const chave = `${dataISO}_${r.idTurno}`;

    if (!agrupado[chave]) {
      // 🔹 Planejado (1x por data + turno)
      const planejadoRes = await buscarDwPlanejado(
        turnoMap[r.idTurno],
        dataISO
      );

      agrupado[chave] = {
        data: dataISO,
        turno: turnoMap[r.idTurno],
        planejado: planejadoRes.data.dwPlanejado,
        empresas: {
          SRM: 0,
          Fenix: 0,
          Horeca: 0,
        },
        totalReal: 0,
      };
    }

    const nomeEmpresa = EMPRESAS_FIXAS[r.idEmpresa];
    if (!nomeEmpresa) continue;

    agrupado[chave].empresas[nomeEmpresa] += r.quantidade;
    agrupado[chave].totalReal += r.quantidade;
  }

  return Object.values(agrupado);
};

module.exports = {
  buscarDwLista,
};
