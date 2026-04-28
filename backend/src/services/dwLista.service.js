const { prisma } = require('../config/database');
const { buscarDwPlanejadoCalculadoraBatch } = require("./googleSheetsCalculadora.service");
const { buscarDwPlanejadoBanco } = require("./dwPlanejado.service");

const ESTACAO_SHEETS = 1;

/* ==========================
   EMPRESAS FIXAS DO DW
========================== */
const EMPRESAS_FIXAS = {
  12: "SRM",
  13: "Fenix",
  14: "Horeca",
  28: "Diarias TECH",
};

const IDS_EMPRESAS_FIXAS = Object.keys(EMPRESAS_FIXAS).map(Number);

const buscarDwLista = async ({ data, idTurno, idEmpresa, idEstacao }) => {
  const andConditions = [];

  // Empresas fixas (ou filtro específico)
  if (idEmpresa && IDS_EMPRESAS_FIXAS.includes(Number(idEmpresa))) {
    andConditions.push({ idEmpresa: Number(idEmpresa) });
  } else {
    andConditions.push({ idEmpresa: { in: IDS_EMPRESAS_FIXAS } });
  }

  if (data) {
    andConditions.push({ data: new Date(data) });
  } else {
    // Sem data: limita aos últimos 30 dias para evitar sobrecarga
    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    andConditions.push({ data: { gte: trintaDiasAtras } });
  }

  if (idTurno) andConditions.push({ idTurno: Number(idTurno) });

  if (idEstacao) {
    // Inclui registros da estação selecionada OU registros sem estação (legado)
    andConditions.push({
      OR: [
        { idEstacao: Number(idEstacao) },
        { idEstacao: null }
      ]
    });
  }

  const where = { AND: andConditions };

  const dwReais = await prisma.dwReal.findMany({
    where,
    orderBy: [{ data: "desc" }, { idTurno: "asc" }],
  });

  const agrupado = {};
  const turnoMap = { 1: "T1", 2: "T2", 3: "T3" };
  const estacaoNum = idEstacao ? Number(idEstacao) : null;

  // Preparar batch de requests para Calculadora (estação 1)
  const batchRequests = [];
  const needsCalculadora = estacaoNum === ESTACAO_SHEETS || !estacaoNum;

  if (needsCalculadora) {
    const uniqueKeys = new Set();
    for (const r of dwReais) {
      const dataISO = r.data.toISOString().slice(0, 10);
      const key = `${dataISO}_${r.idTurno}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        batchRequests.push({ dataISO, idTurno: r.idTurno });
      }
    }
  }

  // Buscar todos os planejados de uma vez
  const planejadosMap = needsCalculadora && batchRequests.length > 0
    ? await buscarDwPlanejadoCalculadoraBatch(batchRequests)
    : new Map();

  for (const r of dwReais) {
    const dataISO = r.data.toISOString().slice(0, 10);
    const chave = `${dataISO}_${r.idTurno}`;

    if (!agrupado[chave]) {
      let planejado = 0;

      if (needsCalculadora) {
        planejado = planejadosMap.get(chave) || 0;
      } else {
        // Demais estações: busca no banco
        const registro = await buscarDwPlanejadoBanco({
          data: dataISO,
          idTurno: r.idTurno,
          idEstacao: estacaoNum
        });
        planejado = registro?.quantidade ?? 0;
      }

      agrupado[chave] = {
        data: dataISO,
        turno: turnoMap[r.idTurno],
        planejado,
        empresas: { SRM: 0, Fenix: 0, Horeca: 0, "Diarias TECH": 0 },
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

module.exports = { buscarDwLista };
