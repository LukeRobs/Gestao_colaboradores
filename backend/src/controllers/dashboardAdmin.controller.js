const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getPeriodoFiltro } = require("../utils/dateRange");

/* =====================================================
   HELPERS
===================================================== */
const normalize = (v) => String(v || "").trim();

const isoDate = (d) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

const daysInclusive = (inicio, fim) => {
  const a = new Date(inicio);
  const b = new Date(fim);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b - a) / 86400000) + 1;
};

/* =====================================================
   STATUS DO DIA
===================================================== */
function getStatusDoDia(f) {
  // Presença
  if (f?.horaEntrada) {
    return {
      code: "P",
      contaComoEscalado: true,
      impactaAbsenteismo: false,
    };
  }

  // Ausências registradas
  if (f?.tipoAusencia) {
    const codigo = f.tipoAusencia.codigo;

    // FO / DSR → registro administrativo
    if (codigo === "FO" || codigo === "DSR") {
      return {
        code: codigo,
        contaComoEscalado: false,  // 🔑
        impactaAbsenteismo: false, // 🔑
      };
    }

    // F, FJ, AM → ausência real
    return {
      code: codigo,
      contaComoEscalado: true,
      impactaAbsenteismo: true,
    };
  }

  // fallback
  return {
    code: "F",
    contaComoEscalado: true,
    impactaAbsenteismo: true,
  };
}


/* =====================================================
   BUILDERS
===================================================== */

/* ---------- GÊNERO ---------- */
function buildGenero(colaboradores) {
  const map = {};
  colaboradores.forEach((c) => {
    const g = normalize(c.genero) || "N/I";
    map[g] = (map[g] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/* ---------- Média de Idade ---------- */
function buildIdadeMedia(colaboradores) {
  const hoje = new Date();
  const idades = colaboradores
    .filter(c => c.dataNascimento)
    .map(c => {
      const nasc = new Date(c.dataNascimento);
      let idade = hoje.getFullYear() - nasc.getFullYear();
      const m = hoje.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
        idade--;
      }
      return idade;
    });

  if (!idades.length) return 0;

  return Math.round(
    idades.reduce((a, b) => a + b, 0) / idades.length
  );
}

/* ---------- Tempo Médio de empresa ---------- */
function buildTempoMedioEmpresa(colaboradores) {
  const hoje = new Date();

  const tempos = colaboradores
    .filter(c => c.dataAdmissao)
    .map(c => {
      const adm = new Date(c.dataAdmissao);
      return Math.floor((hoje - adm) / 86400000);
    });

  if (!tempos.length) return 0;

  return Math.round(
    tempos.reduce((a, b) => a + b, 0) / tempos.length
  );
}

/* ---------- STATUS dos COLABORADORES ---------- */
function buildStatusColaboradores({
  colaboradores,
  atestados,
}) {
  const status = {
    ativos: 0,
    afastadosCurto: 0,
    inss: 0,
    ferias: 0,
    inativos: 0,
  };

  /* ===============================
     MAPA DE ATESTADOS (DIAS)
  =============================== */
  const atestadosMap = new Map();
  atestados.forEach(a => {
    const dias = daysInclusive(a.dataInicio, a.dataFim);
    atestadosMap.set(a.opsId, dias);
  });

  /* ===============================
     CLASSIFICAÇÃO FINAL
  =============================== */
  colaboradores.forEach(c => {
    const statusColab = String(c.status).toUpperCase();

    // 1️⃣ INATIVO
    if (statusColab === "INATIVO") {
      status.inativos++;
      return;
    }

    // 2️⃣ FÉRIAS
    if (statusColab === "FERIAS") {
      status.ferias++;
      return;
    }

    // 3️⃣ AFASTADO (refinado por atestado)
    if (statusColab === "AFASTADO") {
      const diasAtestado = atestadosMap.get(c.opsId) || 0;

      if (diasAtestado >= 16) {
        status.inss++;
      } else {
        status.afastadosCurto++;
      }
      return;
    }

    // 4️⃣ ATIVO
    status.ativos++;
  });

  const indisponiveis =
    status.afastadosCurto + status.inss + status.ferias;

  return {
    ...status,
    indisponiveis,
    percentualIndisponivel:
      colaboradores.length > 0
        ? Number(
            ((indisponiveis / colaboradores.length) * 100).toFixed(2)
          )
        : 0,
  };
}


/* ---------- ESCALAS ---------- */
function buildEscalas(colaboradores, frequencias, colaboradoresMap) {
  const map = {};

  frequencias.forEach(f => {
    const s = getStatusDoDia(f);

    // 🔑 só quem estava escalado no dia
    if (!s.contaComoEscalado) return;

    const c = colaboradoresMap.get(f.opsId);
    if (!c) return;

    const esc = c.escala?.nomeEscala || "N/I";

    if (!map[esc]) {
      map[esc] = {
        escala: esc,
        total: 0,
        absDias: 0,
      };
    }

    // TOTAL = escalados do dia naquela escala
    map[esc].total++;

    // ABS = ausência real (F, FJ, AM)
    if (s.impactaAbsenteismo) {
      map[esc].absDias++;
    }
  });

  return Object.values(map).map(e => ({
    escala: e.escala,
    total: e.total,
    absenteismo:
      e.total > 0
        ? Number(((e.absDias / e.total) * 100).toFixed(2))
        : 0,
  }));
}



/* ---------- Lideres ---------- */
function buildLideres(colaboradores, frequencias, colaboradoresMap) {
  const map = {};

  frequencias.forEach(f => {
    const s = getStatusDoDia(f);

    // 🔑 só quem estava escalado no dia
    if (!s.contaComoEscalado) return;

    const c = colaboradoresMap.get(f.opsId);
    if (!c) return;

    const lider = c.lider?.nomeCompleto || "Sem líder";

    if (!map[lider]) {
      map[lider] = {
        lider,
        total: 0,
        absDias: 0,
      };
    }

    // TOTAL = escalados do dia sob esse líder
    map[lider].total++;

    // ABS = ausência real (F, FJ, AM)
    if (s.impactaAbsenteismo) {
      map[lider].absDias++;
    }
  });

  return Object.values(map)
    .map(l => ({
      lider: l.lider,
      totalColaboradores: l.total,
      absenteismo:
        l.total > 0
          ? Number(((l.absDias / l.total) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.absenteismo - a.absenteismo);
}

/* ---------- OVERVIEW ---------- */
function buildOverview({ frequencias, inicio, fim }) {
  if (!frequencias.length) {
    return {
      totalColaboradores: 0,
      presentes: 0,
      absenteismo: 0,
    };
  }

  const diasPeriodo = daysInclusive(inicio, fim);

  let absDias = 0;

  const escaladosSet = new Set();
  const presentesSet = new Set();

  frequencias.forEach(f => {
    const s = getStatusDoDia(f);

    // só quem estava escalado no dia
    if (!s.contaComoEscalado) return;

    escaladosSet.add(f.opsId);

    if (s.code === "P") {
      presentesSet.add(f.opsId);
    }

    if (s.impactaAbsenteismo) {
      absDias++;
    }
  });

  const totalEscalados = escaladosSet.size;
  const diasEsperados = totalEscalados * diasPeriodo;

  return {
    totalColaboradores: totalEscalados,
    presentes: presentesSet.size,
    absenteismo:
      diasEsperados > 0
        ? Number(((absDias / diasEsperados) * 100).toFixed(2))
        : 0,
  };
}


/* ---------- TURNOVER GLOBAL ---------- */
function buildTurnoverGlobal({
  totalColaboradores,
  admitidosPeriodo,
  desligadosPeriodo,
}) {
  if (!totalColaboradores) return 0;

  const mediaMovimentacao =
    (admitidosPeriodo + desligadosPeriodo) / 2;

  return Number(
    ((mediaMovimentacao / totalColaboradores) * 100).toFixed(2)
  );
}


/* ---------- EVENTOS ---------- */
function buildEventos({ colaboradoresMap, atestados, acidentes, medidas }) {
  const eventos = [];

  atestados.forEach((a) => {
    const c = colaboradoresMap.get(a.opsId);
    eventos.push({
      id: `AT-${a.idAtestado}`,
      nome: c?.nomeCompleto || "-",
      empresa: c?.empresa?.razaoSocial || "-",
      setor: c?.setor?.nomeSetor || "-",
      evento: "Atestado",
      data: a.dataInicio,
    });
  });

  medidas.forEach((m) => {
    const c = colaboradoresMap.get(m.opsId);
    eventos.push({
      id: `MD-${m.idMedida}`,
      nome: c?.nomeCompleto || "-",
      empresa: c?.empresa?.razaoSocial || "-",
      setor: c?.setor?.nomeSetor || "-",
      evento: "Medida Disciplinar",
      data: m.dataAplicacao,
    });
  });

  acidentes.forEach((a) => {
    const c = colaboradoresMap.get(a.opsIdColaborador);
    eventos.push({
      id: `AC-${a.idAcidente}`,
      nome: c?.nomeCompleto || "-",
      empresa: c?.empresa?.razaoSocial || "-",
      setor: c?.setor?.nomeSetor || "-",
      evento: "Acidente",
      data: a.dataOcorrencia,
    });
  });

  /* 🔁 REINCIDÊNCIA */
  const contador = {};
  eventos.forEach(e => {
    const key = `${e.nome}-${e.evento}`;
    contador[key] = (contador[key] || 0) + 1;
  });

  eventos.forEach(e => {
    const key = `${e.nome}-${e.evento}`;
    e.reincidente = contador[key] > 1;
    e.qtdeEventos = contador[key];
  });

  return eventos.sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  );
}


/* ---------- EMPRESAS RESUMO + TURNOVER + ABSENTEÍSMO ---------- */
function buildEmpresasResumo({
  colaboradores,
  colaboradoresMap,
  frequencias,
  atestados,
  medidas,
  acidentes,
  desligados,
  admitidos,
  inicio,
  fim,
}) {
  const diasPeriodo = daysInclusive(inicio, fim);
  const map = {};
  const colaboradoresAtivosPeriodo = {};

  /* ===============================
     BASE: COLABORADORES POR EMPRESA
  =============================== */
  colaboradores.forEach(c => {
    const emp = c.empresa?.razaoSocial || "Sem empresa";

    if (!map[emp]) {
      map[emp] = {
        empresa: emp,
        colaboradores: [],
        totalColaboradores: 0,
        presentes: new Set(),
        absDias: 0,
        atestados: 0,
        medidasDisciplinares: 0,
        acidentes: 0,
        desligados: 0,
        admitidos: 0,
      };
    }

    map[emp].totalColaboradores++;
    map[emp].colaboradores.push(c);
  });

  /* ===============================
     FREQUÊNCIAS
  =============================== */
  frequencias.forEach(f => {
    const c = colaboradoresMap.get(f.opsId);
    if (!c) return;

    const emp = c.empresa?.razaoSocial || "Sem empresa";
    const s = getStatusDoDia(f);

    if (!colaboradoresAtivosPeriodo[emp]) {
      colaboradoresAtivosPeriodo[emp] = new Set();
    }
    if (s.contaComoEscalado) {
    colaboradoresAtivosPeriodo[emp].add(f.opsId);
    }

    if (s.code === "P") {
      map[emp].presentes.add(f.opsId);
    }

    if (s.impactaAbsenteismo) {
      map[emp].absDias++;
    }
  });


  /* ===============================
     EVENTOS
  =============================== */
  atestados.forEach(a => {
    const c = colaboradoresMap.get(a.opsId);
    if (c) map[c.empresa?.razaoSocial || "Sem empresa"].atestados++;
  });

  medidas.forEach(m => {
    const c = colaboradoresMap.get(m.opsId);
    if (c) map[c.empresa?.razaoSocial || "Sem empresa"].medidasDisciplinares++;
  });

  acidentes.forEach(a => {
    const c = colaboradoresMap.get(a.opsIdColaborador);
    if (c) map[c.empresa?.razaoSocial || "Sem empresa"].acidentes++;
  });

  desligados.forEach(c => {
    const emp = c.empresa?.razaoSocial || "Sem empresa";
    if (map[emp]) map[emp].desligados++;
  });

  admitidos.forEach(c => {
    const emp = c.empresa?.razaoSocial || "Sem empresa";
    if (map[emp]) map[emp].admitidos++;
  });

  /* ===============================
     CALCULA EMPRESAS
  =============================== */
  const empresas = Object.values(map).map(e => {
    const totalPeriodo = 
      colaboradoresAtivosPeriodo[e.empresa]?.size || 0;

    const diasEsperados = totalPeriodo * diasPeriodo

    const absenteismo =
      diasEsperados > 0
        ? Number(((e.absDias / diasEsperados) * 100).toFixed(2))
        : 0;

    const mediaMovimentacao = (e.admitidos + e.desligados) / 2;

    const turnover =
      totalPeriodo > 0
        ? Number(((mediaMovimentacao / totalPeriodo) * 100).toFixed(2)
          )
        : 0;

    return {
      empresa: e.empresa,
      totalColaboradores: totalPeriodo,
      presentes: e.presentes.size,

      absenteismo,
      medidasDisciplinares: e.medidasDisciplinares,
      atestados: e.atestados,
      acidentes: e.acidentes,

      turnover,
      tempoMedioEmpresaDias: buildTempoMedioEmpresa(e.colaboradores),
    };
  });

  /* ===============================
     TOTAL BPO
  =============================== */
  const bpoEmpresas = ["ADECCO", "ADILIS", "LUANDRE"];
  const bpo = empresas.filter(e =>
    bpoEmpresas.includes(e.empresa.toUpperCase())
  );

  if (bpo.length) {
    const totalColaboradores = bpo.reduce((s, e) => s + e.totalColaboradores, 0);
    const presentes = bpo.reduce((s, e) => s + e.presentes, 0);
    const atestadosTot = bpo.reduce((s, e) => s + e.atestados, 0);
    const medidasTot = bpo.reduce((s, e) => s + e.medidasDisciplinares, 0);
    const acidentesTot = bpo.reduce((s, e) => s + e.acidentes, 0);


    const mediaMov = (admitidos.length + desligados.length) / 2;

    const turnover =
      totalColaboradores > 0
        ? Number(((mediaMov / totalColaboradores) * 100).toFixed(2))
        : 0;

    empresas.push({
      empresa: "TOTAL BPO",
      totalColaboradores,
      presentes,
      absenteismo:
        totalColaboradores > 0
          ? Number(
              (
                bpo.reduce((s, e) => s + e.absenteismo * e.totalColaboradores, 0) /
                totalColaboradores
              ).toFixed(2)
            )
          : 0,
      medidasDisciplinares: medidasTot,
      atestados: atestadosTot,
      acidentes: acidentesTot,
      turnover,
      tempoMedioEmpresaDias: Math.round(
        bpo.reduce(
          (s, e) => s + e.tempoMedioEmpresaDias * e.totalColaboradores,
          0
        ) / totalColaboradores
      ),
    });
  }

  return empresas;
}

/* =====================================================
   CONTROLLER — DASHBOARD ADMIN
===================================================== */
const carregarDashboardAdmin = async (req, res) => {
  try {
    const { inicio, fim } = getPeriodoFiltro(req.query);
    const { turno } = req.query;

    /* ===============================
       COLABORADORES BASE
    =============================== */
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
        ...(turno && turno !== "ALL" && {
          turno: { nomeTurno: turno },
        }),
      },
      include: {
        empresa: true,
        setor: true,
        turno: true,
        escala: true,
        lider: true,
      },
    });

    const opsIds = colaboradores.map(c => c.opsId);

    if (!opsIds.length) {
      return res.json({
        success: true,
        data: {
          periodo: { inicio: isoDate(inicio), fim: isoDate(fim) },
          kpis: {},
          statusColaboradores: {},
          genero: [],
          empresasResumo: [],
          escalas: [],
          lideres: [],
          eventos: [],
        },
      });
    }

    const colaboradoresMap = new Map(
      colaboradores.map(c => [c.opsId, c])
    );

    /* ===============================
       DADOS AUXILIARES
    =============================== */
/* ===============================
   BASE REAL DO PERÍODO (ESCALADOS)
=============================== */
    const frequencias = await prisma.frequencia.findMany({
      where: {
        opsId: { in: opsIds },
        dataReferencia: { gte: inicio, lte: fim },
      },
      include: { tipoAusencia: true },
    });

    const opsIdsEscaladosPeriodo = Array.from(
      new Set(
        frequencias
          .filter(f => getStatusDoDia(f).contaComoEscalado)
          .map(f => f.opsId)
      )
    );

    // colaboradores realmente escalados no período
    const colaboradoresPeriodo = colaboradores.filter(c =>
      opsIdsEscaladosPeriodo.includes(c.opsId)
    );

    const atestados = await prisma.atestadoMedico.findMany({
      where: {
        opsId: { in: opsIds },
        dataInicio: { lte: fim },
        dataFim: { gte: inicio },
      },
    });

    const medidas = await prisma.medidaDisciplinar.findMany({
      where: {
        opsId: { in: opsIds },
        dataAplicacao: { gte: inicio, lte: fim },
      },
    });

    const acidentes = await prisma.acidenteTrabalho.findMany({
      where: {
        opsIdColaborador: { in: opsIds },
        dataOcorrencia: { gte: inicio, lte: fim },
      },
    });

    const desligados = await prisma.colaborador.findMany({
      where: {
        status: "INATIVO",
        dataDesligamento: { gte: inicio, lte: fim },
      },
    });

    const admitidos = await prisma.colaborador.findMany({
      where: {
        dataAdmissao: { gte: inicio, lte: fim },
      },
    });

    const overview = buildOverview({ frequencias, inicio, fim });

    /* ===============================
       RESPONSE FINAL
    =============================== */
    return res.json({
      success: true,
      data: {
        periodo: { inicio: isoDate(inicio), fim: isoDate(fim) },

        kpis: {
          totalColaboradores: overview.totalColaboradores,
          presentes: overview.presentes,
          absenteismo: overview.absenteismo,
          turnover: buildTurnoverGlobal({
            totalColaboradores: overview.totalColaboradores,
            admitidosPeriodo: admitidos.length,
            desligadosPeriodo: desligados.length,
          }),
          atestados: atestados.filter(a =>
            opsIdsEscaladosPeriodo.includes(a.opsId)
          ).length,
          medidasDisciplinares: medidas.length,
          acidentes: acidentes.length,
          idadeMedia: buildIdadeMedia(colaboradoresPeriodo),
          tempoMedioEmpresaDias: buildTempoMedioEmpresa(colaboradoresPeriodo, fim),
        },

        statusColaboradores: buildStatusColaboradores({
          colaboradores: colaboradoresPeriodo,
          atestados,
        }),

        genero: buildGenero(colaboradoresPeriodo),

        empresasResumo: buildEmpresasResumo({
          colaboradores,
          colaboradoresMap,
          frequencias,
          atestados,
          medidas,
          acidentes,
          desligados,
          admitidos,
          inicio,
          fim,
        }),

        escalas: buildEscalas(
          colaboradoresPeriodo,
          frequencias,
          colaboradoresMap
        ),

        lideres: buildLideres(
          colaboradoresPeriodo,
          frequencias,
          colaboradoresMap
        ),

        eventos: buildEventos({
          colaboradoresMap,
          atestados,
          acidentes,
          medidas,
        }),
      },
    });
  } catch (error) {
    console.error("❌ Erro dashboard admin:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao carregar dashboard administrativo",
    });
  }
};

module.exports = { carregarDashboardAdmin };
