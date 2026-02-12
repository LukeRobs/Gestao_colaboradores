const { prisma } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");

/* ===================================================== */
function dateOnlyBrasil(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z");
}

/* ===================================================== */
/* RESUMO */
const getResumoAtestados = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    /* =========================================
       BUSCA ATESTADOS DO PERÍODO
    ========================================= */
    const atestadosPeriodo = await prisma.atestadoMedico.findMany({
      where: {
        dataInicio: { gte: inicioDate, lte: fimDate },
        status: { not: "CANCELADO" },
      },
      select: {
        opsId: true,
        diasAfastamento: true,
      },
    });

    const totalPeriodo = atestadosPeriodo.length;

    const diasAfastados = atestadosPeriodo.reduce(
      (acc, a) => acc + (a.diasAfastamento || 0),
      0
    );

    /* =========================================
       COLABORADORES IMPACTADOS + RECORRÊNCIA
    ========================================= */

    const mapaColaboradores = {};

    for (const a of atestadosPeriodo) {
      if (!mapaColaboradores[a.opsId]) {
        mapaColaboradores[a.opsId] = 0;
      }
      mapaColaboradores[a.opsId] += 1;
    }

    const colaboradoresImpactados = Object.keys(mapaColaboradores).length;

    const colaboradoresRecorrentes = Object.values(mapaColaboradores)
      .filter((qtd) => qtd >= 2).length;

    const recorrencia =
      colaboradoresImpactados > 0
        ? Number(
            (
              (colaboradoresRecorrentes / colaboradoresImpactados) *
              100
            ).toFixed(2)
          )
        : 0;

    /* =========================================
       HC ATIVO + % SOBRE HC
    ========================================= */
    const hcTotal = await prisma.colaborador.count({
      where: { status: "ATIVO" },
    });

    const percentualHC =
      hcTotal > 0
        ? Number(
            ((colaboradoresImpactados / hcTotal) * 100).toFixed(2)
          )
        : 0;

    /* =========================================
       HOJE
    ========================================= */
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const atestadosHoje = await prisma.atestadoMedico.count({
      where: {
        dataInicio: {
          gte: hoje,
          lt: amanha,
        },
        status: { not: "CANCELADO" },
      },
    });

    /* =========================================
       SEMANA ATUAL (SEG → HOJE)
    ========================================= */
    const diaSemana = hoje.getDay();
    const diff = diaSemana === 0 ? 6 : diaSemana - 1;

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diff);

    const semanaAtual = await prisma.atestadoMedico.count({
      where: {
        dataInicio: { gte: inicioSemana, lte: hoje },
        status: { not: "CANCELADO" },
      },
    });

    /* =========================================
       MÊS ATUAL
    ========================================= */
    const inicioMes = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    );

    const mesAtual = await prisma.atestadoMedico.count({
      where: {
        dataInicio: { gte: inicioMes, lte: hoje },
        status: { not: "CANCELADO" },
      },
    });

    return successResponse(res, {
      kpis: {
        totalPeriodo,
        recorrencia, // 🔥 NOVO KPI
        diasAfastados,
        colaboradoresImpactados,
        percentualHC,
        hoje: atestadosHoje,
        semana: semanaAtual,
        mes: mesAtual,
      },
    });
  } catch (err) {
    console.error("❌ RESUMO ATESTADOS:", err);
    return errorResponse(res, "Erro ao gerar resumo", 500);
  }
};



/* ===================================================== */
/* DISTRIBUIÇÕES */
const diffDays = (start, end) => {
  return Math.floor(
    (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)
  );
};

function getFaixaTempoEmpresa(adm, ref) {
  if (!adm || !ref) return "N/I";

  const dias = diffDays(adm, ref);

  if (dias < 30) return "< 30 dias";
  if (dias < 90) return "30–89 dias";
  return "≥ 90 dias";
}

const normalize = (v) =>
  String(v || "").trim();

const getDistribuicoesAtestados = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    const atestados = await prisma.atestadoMedico.findMany({
      where: {
        dataInicio: { gte: inicioDate, lte: fimDate },
        status: { not: "CANCELADO" },
      },
      include: {
        colaborador: {
          include: {
            empresa: true,
            setor: true,
            turno: true,
            lider: true,
          },
        },
      },
    });

    const acc = {
      empresa: {},
      setor: {},
      turno: {},
      genero: {},
      lider: {},
      cid: {},
      tempoCasa: {}, // 🔥 NOVO
    };

    for (const a of atestados) {
      const c = a.colaborador;
      if (!c) continue;

      const empresa = normalize(c.empresa?.razaoSocial) || "N/I";
      const setor = normalize(c.setor?.nomeSetor) || "N/I";
      const turno = normalize(c.turno?.nomeTurno) || "N/I";
      const genero = normalize(c.genero) || "N/I";
      const lider = normalize(c.lider?.nomeCompleto) || "Sem líder";

      const tempoCasa = getFaixaTempoEmpresa(
        c.dataAdmissao,
        fimDate
      );

      acc.empresa[empresa] = (acc.empresa[empresa] || 0) + 1;
      acc.setor[setor] = (acc.setor[setor] || 0) + 1;
      acc.turno[turno] = (acc.turno[turno] || 0) + 1;
      acc.genero[genero] = (acc.genero[genero] || 0) + 1;
      acc.lider[lider] = (acc.lider[lider] || 0) + 1;
      acc.tempoCasa[tempoCasa] =
        (acc.tempoCasa[tempoCasa] || 0) + 1;

      if (a.cid) {
        const cid = normalize(a.cid);
        acc.cid[cid] = (acc.cid[cid] || 0) + 1;
      }
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
      porLider: toArray(acc.lider),
      porCid: toArray(acc.cid).slice(0, 10),
      porTempoCasa: toArray(acc.tempoCasa), // 🔥 NOVO
    });
  } catch (err) {
    console.error("❌ DISTRIBUIÇÕES:", err);
    return errorResponse(res, "Erro ao buscar distribuições", 500);
  }
};


/* ===================================================== */
/* TENDÊNCIA */
const getTendenciaAtestados = async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    const registros = await prisma.atestadoMedico.findMany({
      where: {
        dataInicio: { gte: inicioDate, lte: fimDate },
        status: { not: "CANCELADO" },
      },
      select: { dataInicio: true },
    });

    const mapa = {};

    registros.forEach((r) => {
      const key = r.dataInicio.toISOString().slice(0, 10);
      mapa[key] = (mapa[key] || 0) + 1;
    });

    const resultado = Object.entries(mapa)
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    return successResponse(res, resultado);
  } catch (err) {
    console.error("❌ TENDÊNCIA:", err);
    return errorResponse(res, "Erro ao buscar tendência", 500);
  }
};

/* ===================================================== */
/* TOP OFENSORES */
const getRiscoAtestados = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim)
      return errorResponse(res, "Período obrigatório", 400);

    const inicioDate = dateOnlyBrasil(inicio);
    const fimDate = dateOnlyBrasil(fim);

    /* ===============================
       BUSCA ATESTADOS + RELAÇÕES
    =============================== */
    const atestados = await prisma.atestadoMedico.findMany({
      where: {
        dataInicio: { gte: inicioDate, lte: fimDate },
        status: { not: "CANCELADO" },
      },
      include: {
        colaborador: {
          include: {
            empresa: true,
            setor: true,
          },
        },
      },
    });

    const mapa = {};
    const refDate = fimDate;

    /* ===============================
       AGRUPAMENTO
    =============================== */
    for (const a of atestados) {
      const c = a.colaborador;
      if (!c) continue;

      if (!mapa[a.opsId]) {
        mapa[a.opsId] = {
          opsId: a.opsId,
          nome: c.nomeCompleto || "N/I",
          empresa: c.empresa?.razaoSocial || "N/I",
          setor: c.setor?.nomeSetor || "N/I",
          totalAtestados: 0,
          diasAfastados: 0,
          dataAdmissao: c.dataAdmissao || null,
        };
      }

      mapa[a.opsId].totalAtestados += 1;
      mapa[a.opsId].diasAfastados += a.diasAfastamento || 0;
    }

    /* ===============================
       HELPERS (mesmo padrão do operacional)
    =============================== */
    function diffDays(start, end) {
      return Math.floor(
        (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)
      );
    }

    function getFaixaTempoEmpresa(adm, ref) {
      if (!adm || !ref) return "N/I";
      const dias = diffDays(adm, ref);
      if (dias < 30) return "< 30 dias";
      if (dias < 90) return "30–89 dias";
      return "≥ 90 dias";
    }

    /* ===============================
       RANKING FINAL
    =============================== */
    const ranking = Object.values(mapa)
      .map((c) => {
        const diasEmpresa = c.dataAdmissao
          ? diffDays(c.dataAdmissao, refDate)
          : 0;

        return {
          opsId: c.opsId,
          nome: c.nome,
          empresa: c.empresa,
          setor: c.setor,
          totalAtestados: c.totalAtestados,
          diasAfastados: c.diasAfastados,
          diasEmpresa,
          tempoCasaFaixa: getFaixaTempoEmpresa(
            c.dataAdmissao,
            refDate
          ),
        };
      })
      .sort((a, b) => {
        // 🔥 1º critério → total de atestados
        if (b.totalAtestados !== a.totalAtestados) {
          return b.totalAtestados - a.totalAtestados;
        }

        // 🔥 2º critério (desempate) → dias afastados
        return b.diasAfastados - a.diasAfastados;
      })
      .slice(0, 10)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
      }));


    return successResponse(res, { topOfensores: ranking });
  } catch (err) {
    console.error("❌ RISCO:", err);
    return errorResponse(res, "Erro ao buscar risco", 500);
  }
};


module.exports = {
  getResumoAtestados,
  getDistribuicoesAtestados,
  getTendenciaAtestados,
  getRiscoAtestados,
};
