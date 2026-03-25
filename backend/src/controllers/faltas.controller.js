const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");

/* ===================================================== */
function dateOnlyBrasil(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/*  WHERE PADRÃO*/
function buildWhere(inicioDate, fimDate) {
  return {
    dataReferencia: {
      gte: inicioDate,
      lte: fimDate,
    },
    idTipoAusencia: {
      in: [3, 32],
    },
    colaborador: {
      is: {
        status: {
          in: ["ATIVO", "FERIAS", "AFASTADO"],
        },
      },
    },
  };
}

/* ===================================================== */
/* RESUMO */
const getResumoFaltas = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    /* 🔥 FALTAS CORRETAS */
    const faltasPeriodo = await prisma.frequencia.findMany({
      where: buildWhere(inicioDate, fimDate),
      select: {
        opsId: true,
        dataReferencia: true,
      },
    });

    // 🔥 evita duplicidade
    const totalPeriodo = new Set(
      faltasPeriodo.map(f => `${f.opsId}_${f.dataReferencia}`)
    ).size;

    /* ========================================= */
    const mapa = {};

    for (const f of faltasPeriodo) {
      mapa[f.opsId] = (mapa[f.opsId] || 0) + 1;
    }

    const colaboradoresImpactados = Object.keys(mapa).length;

    const colaboradoresRecorrentes = Object.values(mapa).filter(
      qtd => qtd >= 2
    ).length;

    const recorrencia =
      colaboradoresImpactados > 0
        ? Number(
            (
              (colaboradoresRecorrentes / colaboradoresImpactados) *
              100
            ).toFixed(2)
          )
        : 0;

    /* ========================================= */
    const hcTotal = await prisma.colaborador.count({
      where: { status: "ATIVO" },
    });

    const percentualHC =
      hcTotal > 0
        ? Number(
            ((colaboradoresImpactados / hcTotal) * 100).toFixed(2)
          )
        : 0;

    /* ========================================= */
    const referencia = fimDate;

    const proximoDia = new Date(referencia);
    proximoDia.setDate(referencia.getDate() + 1);

    const faltasHoje = await prisma.frequencia.count({
      where: {
        ...buildWhere(referencia, referencia),
      },
    });

    /* ========================================= */
    const diaSemana = referencia.getDay();
    const diff = diaSemana === 0 ? 6 : diaSemana - 1;

    const inicioSemana = new Date(referencia);
    inicioSemana.setDate(referencia.getDate() - diff);

    const semanaAtual = await prisma.frequencia.count({
      where: buildWhere(inicioSemana, referencia),
    });

    /* ========================================= */
    const inicioMes = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      1
    );

    const mesAtual = await prisma.frequencia.count({
      where: buildWhere(inicioMes, referencia),
    });

    return successResponse(res, {
      kpis: {
        totalPeriodo, // 🔥 agora bate com admin
        recorrencia,
        colaboradoresImpactados,
        percentualHC,
        hoje: faltasHoje,
        semana: semanaAtual,
        mes: mesAtual,
      },
    });

  } catch (err) {
    console.error("❌ RESUMO FALTAS:", err);
    return errorResponse(res, "Erro ao gerar resumo", 500);
  }
};

/* ===================================================== */
/* DISTRIBUIÇÕES */
const getDistribuicoesFaltas = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    const faltas = await prisma.frequencia.findMany({
      where: buildWhere(inicioDate, fimDate),
      include: {
        colaborador: {
          include: {
            empresa: true,
            setor: true,
            turno: true,
            lider: true,
            escala: true,
          },
        },
      },
    });

    const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const acc = {
      empresa: {},
      setor: {},
      turno: {},
      genero: {},
      lider: {},
      diaSemana: {},
      escala: {},
    };

    for (const f of faltas) {
      const c = f.colaborador;
      if (!c) continue;

      const empresa = c.empresa?.razaoSocial || "N/I";
      const setor = c.setor?.nomeSetor || "N/I";
      const turno = c.turno?.nomeTurno || "N/I";
      const genero = c.genero || "N/I";
      const lider = c.lider?.nomeCompleto || "Sem líder";
      const diaSemana = DIAS_SEMANA[new Date(f.dataReferencia).getDay()];
      const escala = c.escala?.nomeEscala || "N/I";

      acc.empresa[empresa] = (acc.empresa[empresa] || 0) + 1;
      acc.setor[setor] = (acc.setor[setor] || 0) + 1;
      acc.turno[turno] = (acc.turno[turno] || 0) + 1;
      acc.genero[genero] = (acc.genero[genero] || 0) + 1;
      acc.lider[lider] = (acc.lider[lider] || 0) + 1;
      acc.diaSemana[diaSemana] = (acc.diaSemana[diaSemana] || 0) + 1;
      acc.escala[escala] = (acc.escala[escala] || 0) + 1;
    }

    const toArray = (obj) =>
      Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return successResponse(res, {
      porEmpresa: toArray(acc.empresa),
      porSetor: toArray(acc.setor),
      porTurno: toArray(acc.turno),
      porGenero: toArray(acc.genero),
      porLider: toArray(acc.lider).slice(0, 10),
      porDiaSemana: toArray(acc.diaSemana),
      porEscala: toArray(acc.escala),
    });

  } catch (err) {
    console.error("❌ DISTRIBUIÇÕES FALTAS:", err);
    return errorResponse(res, "Erro ao buscar distribuições", 500);
  }
};

/* ===================================================== */
/* TENDÊNCIA */
const getTendenciaFaltas = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    const registros = await prisma.frequencia.findMany({
      where: buildWhere(inicioDate, fimDate),
      select: {
        opsId: true,
        dataReferencia: true,
      },
    });

    const mapa = {};

    registros.forEach((r) => {
      const key = r.dataReferencia.toISOString().slice(0, 10);

      if (!mapa[key]) mapa[key] = new Set();

      mapa[key].add(r.opsId);
    });

    const resultado = Object.entries(mapa)
      .map(([data, set]) => ({
        data,
        total: set.size, // 🔥 evita duplicidade
      }))
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    return successResponse(res, resultado);

  } catch (err) {
    console.error("❌ TENDÊNCIA FALTAS:", err);
    return errorResponse(res, "Erro ao buscar tendência", 500);
  }
};

const getColaboradoresFaltas = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim) {
      return errorResponse(res, "Período obrigatório", 400);
    }

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    const registros = await prisma.frequencia.findMany({
      where: buildWhere(inicioDate, fimDate),
      include: {
        colaborador: {
          include: {
            empresa: true,
            setor: true,
            turno: true,
            escala: true,
          },
        },
      },
      orderBy: [
        { dataReferencia: "asc" },
        { opsId: "asc" },
      ],
    });

    const mapa = {};

    registros.forEach((f) => {
      const c = f.colaborador;
      if (!c) return;

      if (!mapa[c.opsId]) {
        mapa[c.opsId] = {
          opsId: c.opsId,
          nome: c.nomeCompleto,
          empresa: c.empresa?.razaoSocial || "N/I",
          setor: c.setor?.nomeSetor || "N/I",
          turno: c.turno?.nomeTurno || "N/I",
          escala: c.escala?.nomeEscala || "N/I",
          dataAdmissao: c.dataAdmissao,
          dias: new Set(),
        };
      }

      mapa[c.opsId].dias.add(
        new Date(f.dataReferencia).toISOString().slice(0, 10)
      );
    });

    const lista = Object.values(mapa)
      .map((c) => ({
        opsId: c.opsId,
        nome: c.nome,
        empresa: c.empresa,
        setor: c.setor,
        turno: c.turno,
        escala: c.escala,
        tempoCasa: getFaixaTempoCasa(c.dataAdmissao, fimDate),
        totalFaltas: c.dias.size,
        recorrencia: c.dias.size >= 2,
      }))
      .sort((a, b) => {
        if (b.totalFaltas !== a.totalFaltas) {
          return b.totalFaltas - a.totalFaltas;
        }
        return a.nome.localeCompare(b.nome);
      });

    const ranking = lista.slice(0, 10);

    return successResponse(res, {
      tabela: lista,
      topOfensores: ranking,
    });
  } catch (err) {
    console.error("❌ COLABORADORES FALTAS:", err);
    return errorResponse(res, "Erro ao buscar colaboradores", 500);
  }
};

function getFaixaTempoCasa(adm, ref) {
  if (!adm) return "N/I";

  const admDate = new Date(adm);
  const refDate = new Date(ref);

  admDate.setHours(0, 0, 0, 0);
  refDate.setHours(0, 0, 0, 0);

  const dias = Math.floor((refDate - admDate) / 86400000);

  if (dias <= 7) return "0–7";
  if (dias <= 15) return "8–15";
  if (dias <= 30) return "16–30";
  if (dias <= 89) return "31–89";
  return "90+";
}

/* ===================================================== */
module.exports = {
  getResumoFaltas,
  getDistribuicoesFaltas,
  getTendenciaFaltas,
  getColaboradoresFaltas,
};