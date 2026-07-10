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
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim();

function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(spString);
}

function formatTempoEmpresa(dataAdmissao) {
  if (!dataAdmissao) return "-";

  const hoje = new Date();
  const adm = new Date(dataAdmissao);

  let meses =
    (hoje.getFullYear() - adm.getFullYear()) * 12 +
    (hoje.getMonth() - adm.getMonth());

  const anos = Math.floor(meses / 12);
  meses = meses % 12;

  if (anos > 0 && meses > 0) return `${anos}a ${meses}m`;
  if (anos > 0) return `${anos}a`;
  return `${meses}m`;
}

function isCargoElegivel(cargo) {
  const nome = String(cargo || "").toUpperCase();
  return (
    nome.includes("AUXILIAR DE LOGÍSTICA I") ||
    nome.includes("AUXILIAR DE LOGÍSTICA II")
  );
}

/* =====================================================
   STATUS DO DIA
===================================================== */
function getStatusDoDia(f) {
  // AM/AA/DSR/FO têm prioridade máxima — mesmo que haja horaEntrada
  if (f?.tipoAusencia) {
    const codigoPrio = String(f.tipoAusencia.codigo || "").toUpperCase();
    if (codigoPrio === "AM" || codigoPrio === "AA") {
      return { code: "AM", contaComoEscalado: true, impactaAbsenteismo: true };
    }
    if (codigoPrio === "DSR") {
      return { code: "DSR", contaComoEscalado: false, impactaAbsenteismo: false };
    }
    if (codigoPrio === "FO") {
      return { code: "FO", contaComoEscalado: true, impactaAbsenteismo: false };
    }
  }

  // Presença via batida de ponto
  if (f?.horaEntrada) {
    return { code: "P", contaComoEscalado: true, impactaAbsenteismo: false };
  }

  if (f?.tipoAusencia) {
    const codigo = String(f.tipoAusencia.codigo || "").toUpperCase();
    const desc   = String(f.tipoAusencia.descricao || "").toUpperCase();

    if (codigo === "NC" || codigo === "ON") {
      return { code: codigo, contaComoEscalado: false, impactaAbsenteismo: false };
    }
    if (codigo === "FE" || desc.includes("FÉRIAS")) {
      return { code: "FE", contaComoEscalado: false, impactaAbsenteismo: false };
    }
    if (codigo === "S1" || desc.includes("SINERGIA")) {
      return { code: "S1", contaComoEscalado: true, impactaAbsenteismo: false };
    }
    if (codigo === "BH" || codigo === "BHDSR") {
      return { code: "BH", contaComoEscalado: true, impactaAbsenteismo: false };
    }
    if (["AFA", "AF", "LM", "LP", "T", "AB", "JE"].includes(codigo)) {
      return { code: codigo, contaComoEscalado: false, impactaAbsenteismo: false };
    }
    // F / FJ e demais → ausência que impacta
    return { code: codigo, contaComoEscalado: true, impactaAbsenteismo: true };
  }

  // fallback = falta
  return { code: "F", contaComoEscalado: true, impactaAbsenteismo: true };
}

/* =====================================================
   BUILDERS
===================================================== */
  function buildEscalasResumo({ frequencias, colaboradoresMap, colaboradores, inicio, fim, atestadosDias = [] }) {
  const diasPeriodo = daysInclusive(inicio, fim);

  // Dias excluídos por colaborador (registros de não-escalado)
  const excludedPerOps = new Map();
  frequencias.forEach(f => {
    const s = getStatusDoDia(f);
    if (!s.contaComoEscalado) {
      excludedPerOps.set(f.opsId, (excludedPerOps.get(f.opsId) || 0) + 1);
    }
  });

  // Dias de ausência por escala (via frequencia)
  const absDiasPerEsc = {};
  frequencias.forEach(f => {
    const s = getStatusDoDia(f);
    if (!s.contaComoEscalado || !s.impactaAbsenteismo) return;
    const c = colaboradoresMap.get(f.opsId);
    if (!c) return;
    const escObj = c.escala;
    const esc = escObj ? `${escObj.nomeEscala} (${escObj.descricao})` : "N/I";
    absDiasPerEsc[esc] = (absDiasPerEsc[esc] || 0) + 1;
  });

  // Atestados não capturados via frequencia
  atestadosDias.forEach(({ colaborador: c }) => {
    if (!c) return;
    const escObj = c.escala;
    const esc = escObj ? `${escObj.nomeEscala} (${escObj.descricao})` : "N/I";
    absDiasPerEsc[esc] = (absDiasPerEsc[esc] || 0) + 1;
  });

  // HC acumulado por escala — apenas ATIVOs
  const hcPerEsc = {};
  const ativosElegiveis = (colaboradores || []).filter(c => c.status === "ATIVO");
  ativosElegiveis.forEach(c => {
    const escObj = c.escala;
    const esc = escObj ? `${escObj.nomeEscala} (${escObj.descricao})` : "N/I";
    const excluded = excludedPerOps.get(c.opsId) || 0;
    hcPerEsc[esc] = (hcPerEsc[esc] || 0) + Math.max(0, diasPeriodo - excluded);
  });

  const allEscalas = new Set([...Object.keys(hcPerEsc), ...Object.keys(absDiasPerEsc)]);
  return Array.from(allEscalas).map(esc => {
    const totalColaboradores = hcPerEsc[esc] || 0;
    const absDias = absDiasPerEsc[esc] || 0;
    return {
      escala: esc,
      totalColaboradores,
      absenteismo: totalColaboradores > 0
        ? Number(((absDias / totalColaboradores) * 100).toFixed(2))
        : 0,
    };
  });
}

  function buildSetoresResumo({ frequencias, colaboradoresMap, colaboradores, inicio, fim, atestadosDias = [] }) {
    const diasPeriodo = daysInclusive(inicio, fim);

    const excludedPerOps = new Map();
    frequencias.forEach(f => {
      const s = getStatusDoDia(f);
      if (!s.contaComoEscalado) {
        excludedPerOps.set(f.opsId, (excludedPerOps.get(f.opsId) || 0) + 1);
      }
    });

    const absDiasPerSetor = {};
    frequencias.forEach(f => {
      const s = getStatusDoDia(f);
      if (!s.contaComoEscalado || !s.impactaAbsenteismo) return;
      const c = colaboradoresMap.get(f.opsId);
      if (!c) return;
      const setor = c.setor?.nomeSetor || "Sem setor";
      absDiasPerSetor[setor] = (absDiasPerSetor[setor] || 0) + 1;
    });

    atestadosDias.forEach(({ colaborador: c }) => {
      if (!c) return;
      const setor = c.setor?.nomeSetor || "Sem setor";
      absDiasPerSetor[setor] = (absDiasPerSetor[setor] || 0) + 1;
    });

    const hcPerSetor = {};
    const ativosElegiveis = (colaboradores || []).filter(c => c.status === "ATIVO");
    ativosElegiveis.forEach(c => {
      const setor = c.setor?.nomeSetor || "Sem setor";
      const excluded = excludedPerOps.get(c.opsId) || 0;
      hcPerSetor[setor] = (hcPerSetor[setor] || 0) + Math.max(0, diasPeriodo - excluded);
    });

    const allSetores = new Set([...Object.keys(hcPerSetor), ...Object.keys(absDiasPerSetor)]);
    return Array.from(allSetores).map(setor => {
      const totalColaboradores = hcPerSetor[setor] || 0;
      const absDias = absDiasPerSetor[setor] || 0;
      return {
        setor,
        totalColaboradores,
        absenteismo: totalColaboradores > 0
          ? Number(((absDias / totalColaboradores) * 100).toFixed(2))
          : 0,
      };
    });
  }

  function buildLideresResumo({ frequencias, colaboradoresMap, colaboradores, inicio, fim, atestadosDias = [] }) {
    const diasPeriodo = daysInclusive(inicio, fim);

    const excludedPerOps = new Map();
    frequencias.forEach(f => {
      const s = getStatusDoDia(f);
      if (!s.contaComoEscalado) {
        excludedPerOps.set(f.opsId, (excludedPerOps.get(f.opsId) || 0) + 1);
      }
    });

    const absDiasPerLider = {};
    frequencias.forEach(f => {
      const s = getStatusDoDia(f);
      if (!s.contaComoEscalado || !s.impactaAbsenteismo) return;
      const c = colaboradoresMap.get(f.opsId);
      if (!c) return;
      const lider = c.lider?.nomeCompleto || "Sem líder";
      absDiasPerLider[lider] = (absDiasPerLider[lider] || 0) + 1;
    });

    atestadosDias.forEach(({ colaborador: c }) => {
      if (!c) return;
      const lider = c.lider?.nomeCompleto || "Sem líder";
      absDiasPerLider[lider] = (absDiasPerLider[lider] || 0) + 1;
    });

    const hcPerLider = {};
    const ativosElegiveis = (colaboradores || []).filter(c => c.status === "ATIVO");
    ativosElegiveis.forEach(c => {
      const lider = c.lider?.nomeCompleto || "Sem líder";
      const excluded = excludedPerOps.get(c.opsId) || 0;
      hcPerLider[lider] = (hcPerLider[lider] || 0) + Math.max(0, diasPeriodo - excluded);
    });

    const allLideres = new Set([...Object.keys(hcPerLider), ...Object.keys(absDiasPerLider)]);
    return Array.from(allLideres).map(lider => {
      const totalColaboradores = hcPerLider[lider] || 0;
      const absDias = absDiasPerLider[lider] || 0;
      return {
        lider,
        totalColaboradores,
        absenteismo: totalColaboradores > 0
          ? Number(((absDias / totalColaboradores) * 100).toFixed(2))
          : 0,
      };
    });
  }

  function buildSetores(colaboradoresPeriodo, frequencias, colaboradoresMap) {
    const map = {};

    frequencias.forEach(f => {
      const s = getStatusDoDia(f);

      // 🔑 só quem estava escalado
      if (!s.contaComoEscalado) return;

      const c = colaboradoresMap.get(f.opsId);
      if (!c) return;

      const setor = c.setor?.nomeSetor || "Sem setor";

      if (!map[setor]) {
        map[setor] = {
          setor,
          total: 0,
          absDias: 0,
        };
      }

      map[setor].total++;

      if (s.impactaAbsenteismo) {
        map[setor].absDias++;
      }
    });

    return Object.values(map).map(s => ({
      setor: s.setor,
      totalColaboradores: s.total,
      absenteismo:
        s.total > 0
          ? Number(((s.absDias / s.total) * 100).toFixed(2))
          : 0,
    }));
  }
/* ---------- GÊNERO ---------- */
function buildGenero(colaboradores) {
  const map = {};
  colaboradores.forEach((c) => {
    const g = normalize(c.genero) || "N/I";
    map[g] = (map[g] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/* ---------- GÊNERO ACUMULADO (pessoa-dias) ---------- */
function buildGeneroAcumulado({ frequencias, colaboradores, inicio, fim }) {
  const diasPeriodo = daysInclusive(inicio, fim);
  const ativosElegiveis = colaboradores.filter(c => c.status === "ATIVO");

  // Dias excluídos por colaborador (registros de não-escalado)
  const excludedPerOps = new Map();
  frequencias.forEach(f => {
    const s = getStatusDoDia(f);
    if (!s.contaComoEscalado) {
      excludedPerOps.set(f.opsId, (excludedPerOps.get(f.opsId) || 0) + 1);
    }
  });

  const map = {};
  ativosElegiveis.forEach(c => {
    const g = normalize(c.genero) || "N/I";
    const excluded = excludedPerOps.get(c.opsId) || 0;
    const days = Math.max(0, diasPeriodo - excluded);
    map[g] = (map[g] || 0) + days;
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
  totalInativos = 0,
}) {
  const status = {
    ativos: 0,
    afastadosCurto: 0,
    inss: 0,
    ferias: 0,
    inativos: totalInativos,
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

    // 1️⃣ FÉRIAS
    if (statusColab === "FERIAS") {
      status.ferias++;
      return;
    }

    // 2️⃣ AFASTADO (refinado por atestado)
    if (statusColab === "AFASTADO") {
      const diasAtestado = atestadosMap.get(c.opsId) || 0;

      if (diasAtestado >= 16) {
        status.inss++;
      } else {
        status.afastadosCurto++;
      }
      return;
    }

    // 3️⃣ ATIVO
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

/* ---------- FALTAS POR TEMPO DE CASA ---------- */
function buildFaltasPorTempoCasa({ frequencias, colaboradoresMap }) {
  const faixas = [
    { label: "< 1 mês",     min: 0,   max: 30   },
    { label: "1–2 meses",   min: 30,  max: 60   },
    { label: "2–3 meses",   min: 60,  max: 90   },
    { label: "3–6 meses",   min: 90,  max: 180  },
    { label: "6–9 meses",   min: 180, max: 270  },
    { label: "9–12 meses",  min: 270, max: 365  },
    { label: "1–1,5 ano",   min: 365, max: 548  },
    { label: "1,5–2 anos",  min: 548, max: 730  },
    { label: "2–3 anos",    min: 730, max: 1095 },
    { label: "> 3 anos",    min: 1095, max: Infinity },
  ];

  const hoje = new Date();

  // inicializa contadores
  const map = {};
  faixas.forEach(f => {
    map[f.label] = { faltas: 0, escalados: 0 };
  });

  frequencias.forEach(f => {
    const s = getStatusDoDia(f);
    if (!s.contaComoEscalado) return;

    const c = colaboradoresMap.get(f.opsId);
    if (!c?.dataAdmissao) return;

    const diasCasa = Math.floor(
      (hoje - new Date(c.dataAdmissao)) / 86400000
    );

    const faixa = faixas.find(
      fx => diasCasa >= fx.min && diasCasa < fx.max
    );
    if (!faixa) return;

    map[faixa.label].escalados++;

    if (s.code === "F" || s.code === "FJ" || s.code === "AM") {
      map[faixa.label].faltas++;
    }
  });

  return faixas.map(f => ({
    faixa: f.label,
    faltas: map[f.label].faltas,
    escalados: map[f.label].escalados,
    percentual:
      map[f.label].escalados > 0
        ? Number(
            ((map[f.label].faltas / map[f.label].escalados) * 100).toFixed(2)
          )
        : 0,
  }));
}

/* ---------- OVERVIEW ---------- */
function buildOverview({ frequencias, inicio, fim, colaboradores = [], opsIdsDesligados = [], atestadosDias = [] }) {
  const diasPeriodo = daysInclusive(inicio, fim);

  // Apenas ATIVOs elegíveis entram no HC (denominador)
  const ativosElegiveis = colaboradores.filter(c => c.status === "ATIVO");
  const ativosSet = new Set(ativosElegiveis.map(c => c.opsId));

  // Para ausências (numerador): ATIVO + recém-desligados (igual ao operacional)
  const absDiasSet = new Set([...ativosSet, ...opsIdsDesligados]);

  // Conta dias excluídos por colaborador ATIVO (DSR, FE, AFA, NC, ON…)
  // Dias sem registro = trabalhando normalmente → não excluído
  let excludedDays = 0;
  let absDias = 0;
  let faltasDias = 0;
  const presentesSet = new Set();

  frequencias.forEach(f => {
    const s = getStatusDoDia(f);

    // Dia excluído do HC: registro de não-escalado para ATIVO
    if (ativosSet.has(f.opsId) && !s.contaComoEscalado) {
      excludedDays++;
    }

    if (s.contaComoEscalado && absDiasSet.has(f.opsId)) {
      if (s.code === "P") presentesSet.add(f.opsId);
      if (s.impactaAbsenteismo) absDias++;
      if (s.code === "F" || s.code === "FJ") faltasDias++;
    }
  });

  // Atestados da tabela atestadoMedico não capturados via frequencia
  atestadosDias.forEach(({ opsId }) => {
    if (ativosSet.has(opsId)) absDias++;
  });

  // HC acumulado = (ATIVOs × dias) − dias excluídos por registros
  // Representa o volume operacional acumulado do período
  const hcAcumulado = Math.max(0, ativosElegiveis.length * diasPeriodo - excludedDays);

  return {
    totalColaboradores: ativosElegiveis.length, // contagem única (compatibilidade)
    hcAcumulado,                                 // pessoa-dias acumulados no período
    presentes: presentesSet.size,
    faltas: faltasDias,
    absDias,
    absenteismo:
      hcAcumulado > 0
        ? Number(((absDias / hcAcumulado) * 100).toFixed(2))
        : 0,
  };
}


/* ---------- TURNOVER GLOBAL ---------- */
function buildTurnoverGlobal({
  hcAcumulado,
  diasPeriodo,
  admitidosPeriodo,
  desligadosPeriodo,
}) {
  // HC médio diário do período (média do volume operacional)
  const hcMedio = diasPeriodo > 0 ? hcAcumulado / diasPeriodo : 0;
  if (!hcMedio) return 0;

  const mediaMovimentacao = (admitidosPeriodo + desligadosPeriodo) / 2;

  return Number(((mediaMovimentacao / hcMedio) * 100).toFixed(2));
}


/* ---------- SÉRIE DIÁRIA (período > 1 dia) ---------- */
function buildSeriesDiarias({ todosElegiveis, inicio, fim }) {
  const days = [];

  // Índices por data para busca O(1)
  const admByDay = {};
  const desByDay = {};
  todosElegiveis.forEach(c => {
    if (c.dataAdmissao) {
      const k = isoDate(c.dataAdmissao);
      admByDay[k] = (admByDay[k] || 0) + 1;
    }
    if (c.dataDesligamento) {
      const k = isoDate(c.dataDesligamento);
      desByDay[k] = (desByDay[k] || 0) + 1;
    }
  });

  const current = new Date(inicio);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(fim);
  endNorm.setHours(0, 0, 0, 0);

  while (current <= endNorm) {
    const dayStr = current.toISOString().slice(0, 10);

    // HC do dia: admitido até este dia e ainda não desligado
    const headcount = todosElegiveis.filter(c => {
      if (!c.dataAdmissao) return false;
      if (isoDate(c.dataAdmissao) > dayStr) return false;
      if (c.dataDesligamento && isoDate(c.dataDesligamento) < dayStr) return false;
      return true;
    }).length;

    const label = `${dayStr.slice(8, 10)}/${dayStr.slice(5, 7)}`;
    days.push({
      dia: label,
      headcount,
      admissoes: admByDay[dayStr] || 0,
      desligamentos: desByDay[dayStr] || 0,
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}


/* ---------- EVENTOS ---------- */
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
      lider: c?.lider?.nomeCompleto || "-",
      tempoEmpresa: formatTempoEmpresa(c?.dataAdmissao),
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
      lider: c?.lider?.nomeCompleto || "-",
      tempoEmpresa: formatTempoEmpresa(c?.dataAdmissao),
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
      lider: c?.lider?.nomeCompleto || "-",
      tempoEmpresa: formatTempoEmpresa(c?.dataAdmissao),
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
  atestadosDias = [],
  medidas,
  acidentes,
  desligados,
  admitidos,
  inicio,
  fim,
}) {
  const diasPeriodo = daysInclusive(inicio, fim);

  // Dias excluídos por colaborador (não-escalado: DSR, FE, AFA…)
  const excludedPerOps = new Map();
  frequencias.forEach(f => {
    const s = getStatusDoDia(f);
    if (!s.contaComoEscalado) {
      excludedPerOps.set(f.opsId, (excludedPerOps.get(f.opsId) || 0) + 1);
    }
  });

  // BASE GLOBAL: quem esteve escalado no período (para filtrar atestados)
  const escaladosSetGlobal = new Set(
    frequencias
      .filter(f => getStatusDoDia(f).contaComoEscalado)
      .map(f => f.opsId)
  );

  const map = {};

  /* ===============================
     BASE: COLABORADORES POR EMPRESA + HC ACUMULADO
  =============================== */
  colaboradores.forEach(c => {
    const emp = c.empresa?.razaoSocial || "Sem empresa";

    if (!map[emp]) {
      map[emp] = {
        empresa: emp,
        colaboradores: [],
        totalColaboradoresCadastrados: 0,
        hcAcumulado: 0,
        presentes: 0,
        absDias: 0,
        faltas: 0,
        atestadosSet: new Set(),
        medidasDisciplinares: 0,
        acidentes: 0,
        desligados: 0,
        admitidos: 0,
      };
    }

    map[emp].totalColaboradoresCadastrados++;
    map[emp].colaboradores.push(c);

    // HC acumulado: apenas ATIVOs, descontando dias não-escalados
    if (c.status === "ATIVO") {
      const excluded = excludedPerOps.get(c.opsId) || 0;
      map[emp].hcAcumulado += Math.max(0, diasPeriodo - excluded);
    }
  });

  /* ===============================
     FREQUÊNCIAS
  =============================== */
  frequencias.forEach(f => {
    const c = colaboradoresMap.get(f.opsId);
    if (!c) return;

    const emp = c.empresa?.razaoSocial || "Sem empresa";
    const s = getStatusDoDia(f);

    if (s.code === "P") map[emp].presentes++;
    if (s.impactaAbsenteismo) map[emp].absDias++;
    if (s.code === "F" || s.code === "FJ") map[emp].faltas++;
  });

  // Atestados não capturados via frequencia — adiciona ao absDias por empresa
  atestadosDias.forEach(({ colaborador: c }) => {
    if (!c) return;
    const emp = c.empresa?.razaoSocial || "Sem empresa";
    if (map[emp]) map[emp].absDias++;
  });

  /* ===============================
     EVENTOS
  =============================== */
  atestados.forEach(a => {
    if (!escaladosSetGlobal.has(a.opsId)) return;
    const c = colaboradoresMap.get(a.opsId);
    if (!c) return;
    const emp = c.empresa?.razaoSocial || "Sem empresa";
    map[emp].atestadosSet.add(a.opsId);
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
    const hcAcumulado = e.hcAcumulado;
    const hcMedio = diasPeriodo > 0 ? hcAcumulado / diasPeriodo : 0;

    const absenteismo = hcAcumulado > 0
      ? Number(((e.absDias / hcAcumulado) * 100).toFixed(2))
      : 0;

    const mediaMovimentacao = (e.admitidos + e.desligados) / 2;
    const turnover = hcMedio > 0
      ? Number(((mediaMovimentacao / hcMedio) * 100).toFixed(2))
      : 0;

    return {
      empresa: e.empresa,
      totalColaboradores: hcAcumulado,
      totalColaboradoresCadastrados: e.totalColaboradoresCadastrados,
      presentes: e.presentes,
      absenteismo,
      faltas: e.faltas || 0,
      medidasDisciplinares: e.medidasDisciplinares,
      atestadosSet: e.atestadosSet,
      atestados: e.atestadosSet.size,
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
    const totalHcAcumulado = bpo.reduce((s, e) => s + e.totalColaboradores, 0);
    const totalColaboradoresCadastrados = bpo.reduce((s, e) => s + (e.totalColaboradoresCadastrados || 0), 0);
    const presentes = bpo.reduce((s, e) => s + e.presentes, 0);
    const faltasTot = bpo.reduce((s, e) => s + (e.faltas || 0), 0);
    const medidasTot = bpo.reduce((s, e) => s + e.medidasDisciplinares, 0);
    const acidentesTot = bpo.reduce((s, e) => s + e.acidentes, 0);

    const atestadosBpoSet = new Set();
    bpo.forEach(e => { e.atestadosSet?.forEach(id => atestadosBpoSet.add(id)); });

    const hcMedioBPO = diasPeriodo > 0 ? totalHcAcumulado / diasPeriodo : 0;
    const mediaMov = (admitidos.length + desligados.length) / 2;
    const turnover = hcMedioBPO > 0
      ? Number(((mediaMov / hcMedioBPO) * 100).toFixed(2))
      : 0;

    const absBPO = totalHcAcumulado > 0
      ? Number((bpo.reduce((s, e) => s + e.absenteismo * e.totalColaboradores, 0) / totalHcAcumulado).toFixed(2))
      : 0;

    empresas.push({
      empresa: "TOTAL BPO",
      totalColaboradores: totalHcAcumulado,
      totalColaboradoresCadastrados,
      presentes,
      absenteismo: absBPO,
      medidasDisciplinares: medidasTot,
      faltas: faltasTot,
      atestados: atestadosBpoSet.size,
      acidentes: acidentesTot,
      turnover,
      tempoMedioEmpresaDias: totalHcAcumulado > 0 ? Math.round(
        bpo.reduce((s, e) => s + e.tempoMedioEmpresaDias * e.totalColaboradores, 0) / totalHcAcumulado
      ) : 0,
    });
  }

  const ORDEM_EMPRESAS = [
    "SPX",
    "TOTAL BPO",
    "ADECCO",
    "ADILIS",
    "LUANDRE",
  ];

  empresas.sort((a, b) => {
    const ia = ORDEM_EMPRESAS.indexOf(a.empresa.toUpperCase());
    const ib = ORDEM_EMPRESAS.indexOf(b.empresa.toUpperCase());

    if (ia === -1 && ib === -1) return a.empresa.localeCompare(b.empresa);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return empresas;
}

  function buildHierarquia({
    colaboradores,
    frequencias,
    atestados,
    inicio,
    fim,
    turnoSelecionado
  }) {
    const diasPeriodo = daysInclusive(inicio, fim);

  // 🔹 Mapear frequências por opsId
  const freqMap = {};
  frequencias.forEach((f) => {
    if (!freqMap[f.opsId]) freqMap[f.opsId] = [];
    freqMap[f.opsId].push(f);
  });

  // ✅ 1) Mapear status do colaborador por opsId
  const colabStatusMap = new Map();
  colaboradores.forEach((c) => colabStatusMap.set(c.opsId, c.status));

  // ✅ 2) Contar atestados apenas para quem NÃO está AFASTADO (INSS)
  const atestadoCountMap = new Map();

  atestados.forEach((a) => {
    const statusColab = colabStatusMap.get(a.opsId);

    // 🔥 regra operacional: não contar INSS/AFASTADO
    if (statusColab === "AFASTADO") return;

    atestadoCountMap.set(
      a.opsId,
      (atestadoCountMap.get(a.opsId) || 0) + 1
    );
  });

    const gerentesMap = new Map();

    // =============================
    // 1️⃣ GERENTES
    // =============================
    colaboradores.forEach((c) => {
      if (!c.idLider) {
        gerentesMap.set(c.opsId, {
          id: c.opsId,
          nome: c.nomeCompleto,
          coordenadores: new Map(),
          supervisores: new Map(), // supervisores diretos (sem coordenador)
          totalColaboradores: 0,
          faltas: 0,
          atestados: 0,
          absDias: 0,
          diasEscalados: 0,
        });
      }
    });

    // =============================
    // 2️⃣ COORDENADORES
    // =============================
    colaboradores.forEach((c) => {
      if (!c.idLider) return;

      const gerenteNode = gerentesMap.get(c.idLider);
      if (!gerenteNode) return;

      const cargo = norm(c.cargo?.nomeCargo);
      if (!cargo.includes("coordenador")) return;

      if (!gerenteNode.coordenadores.has(c.opsId)) {
        gerenteNode.coordenadores.set(c.opsId, {
          id: c.opsId,
          nome: c.nomeCompleto,
          supervisores: new Map(),
          totalColaboradores: 0,
          faltas: 0,
          atestados: 0,
          absDias: 0,
          diasEscalados: 0,
        });
      }
    });

    // =============================
    // 3️⃣ SUPERVISORES
    // =============================
    colaboradores.forEach((c) => {
      if (!c.idLider) return;

      const cargo = norm(c.cargo?.nomeCargo);
      if (!cargo.includes("supervisor")) return;

      // Tenta vincular ao coordenador primeiro
      let adicionado = false;
      gerentesMap.forEach((gerenteNode) => {
        const coordNode = gerenteNode.coordenadores.get(c.idLider);
        if (coordNode && !coordNode.supervisores.has(c.opsId)) {
          coordNode.supervisores.set(c.opsId, {
            id: c.opsId,
            nome: c.nomeCompleto,
            lideres: new Map(),
            supervisionadosDiretos: [],
            totalColaboradores: 0,
            faltas: 0,
            atestados: 0,
            absDias: 0,
            diasEscalados: 0,
          });
          adicionado = true;
        }
      });

      // Fallback: supervisor vinculado diretamente ao gerente
      if (!adicionado) {
        const gerenteNode = gerentesMap.get(c.idLider);
        if (gerenteNode && !gerenteNode.supervisores.has(c.opsId)) {
          gerenteNode.supervisores.set(c.opsId, {
            id: c.opsId,
            nome: c.nomeCompleto,
            lideres: new Map(),
            supervisionadosDiretos: [],
            totalColaboradores: 0,
            faltas: 0,
            atestados: 0,
            absDias: 0,
            diasEscalados: 0,
          });
        }
      }
    });

    // =============================
    // 4️⃣ LÍDERES
    // =============================
    colaboradores.forEach((c) => {
      if (!c.idLider) return;

      const cargo = norm(c.cargo?.nomeCargo);
      if (!cargo.includes("lider")) return;

      gerentesMap.forEach((gerenteNode) => {
        // Supervisores diretos do gerente
        const supDireto = gerenteNode.supervisores.get(c.idLider);
        if (supDireto && !supDireto.lideres.has(c.opsId)) {
          supDireto.lideres.set(c.opsId, {
            id: c.opsId,
            nome: c.nomeCompleto,
            colaboradores: [],
            totalColaboradores: 0,
            faltas: 0,
            atestados: 0,
            absDias: 0,
            diasEscalados: 0,
          });
        }

        // Supervisores sob coordenadores
        gerenteNode.coordenadores.forEach((coordNode) => {
          const supNode = coordNode.supervisores.get(c.idLider);
          if (supNode && !supNode.lideres.has(c.opsId)) {
            supNode.lideres.set(c.opsId, {
              id: c.opsId,
              nome: c.nomeCompleto,
              colaboradores: [],
              totalColaboradores: 0,
              faltas: 0,
              atestados: 0,
              absDias: 0,
              diasEscalados: 0,
            });
          }
        });
      });
    });

    // 🔥 FILTRO DE TURNO PARA OPERADORES
    const colaboradoresOperacionais =
      !turnoSelecionado || turnoSelecionado === "ALL"
        ? colaboradores
        : colaboradores.filter((c) => {
            const cargo = norm(c.cargo?.nomeCargo);

            const isEstrutura =
              cargo.includes("gerente") ||
              cargo.includes("coordenador") ||
              cargo.includes("supervisor") ||
              cargo.includes("lider");

            if (isEstrutura) return false;

            return c.turno?.nomeTurno === turnoSelecionado;
          });

    // =============================
    // 5️⃣ OPERADORES + MÉTRICAS
    // =============================

    colaboradoresOperacionais.forEach((c) => {
      if (!c.idLider) return;
      if (c.status === "AFASTADO") return;

      const cargo = norm(c.cargo?.nomeCargo);

      const isSupervisor = cargo.includes("supervisor");
      const isLider = cargo.includes("lider");
      const isCoordenador = cargo.includes("coordenador");

      if (isSupervisor || isLider || isCoordenador) return;

      const freqs = freqMap[c.opsId] || [];

      let absDias = 0;
      let faltas = 0;
      let diasEscalados = 0;

      freqs.forEach((f) => {
        const status = getStatusDoDia(f);
        if (!status.contaComoEscalado) return;

        diasEscalados++;

        if (status.impactaAbsenteismo) absDias++;
        if (status.code === "F" || status.code === "FJ") faltas++;
      });

      const atestado = atestadoCountMap.get(c.opsId) || 0;

      let supervisorNode = null;
      let coordenadorNode = null;
      let gerenteNode = null;
      let liderNode = null;

      gerentesMap.forEach((g) => {
        // Supervisor direto do gerente
        const supDireto = g.supervisores.get(c.idLider);
        if (supDireto) { supervisorNode = supDireto; gerenteNode = g; }

        g.supervisores.forEach((s) => {
          const l = s.lideres.get(c.idLider);
          if (l) { liderNode = l; supervisorNode = s; gerenteNode = g; }
        });

        // Via coordenador
        g.coordenadores.forEach((coord) => {
          const sup = coord.supervisores.get(c.idLider);
          if (sup) { supervisorNode = sup; coordenadorNode = coord; gerenteNode = g; }

          coord.supervisores.forEach((s) => {
            const l = s.lideres.get(c.idLider);
            if (l) { liderNode = l; supervisorNode = s; coordenadorNode = coord; gerenteNode = g; }
          });
        });
      });

      if (!supervisorNode || !gerenteNode) return;

      // 🔹 Se for operador direto do supervisor
      if (!liderNode) {
        supervisorNode.supervisionadosDiretos.push({
          opsId: c.opsId,
          nome: c.nomeCompleto,
          setor: c.setor?.nomeSetor || "-",
          empresa: c.empresa?.razaoSocial || "-",
        });
      } else {
        liderNode.colaboradores.push({
          opsId: c.opsId,
          nome: c.nomeCompleto,
          setor: c.setor?.nomeSetor || "-",
          empresa: c.empresa?.razaoSocial || "-",
        });

        // Métricas líder
        liderNode.totalColaboradores++;
        liderNode.faltas += faltas;
        liderNode.atestados += atestado;
        liderNode.absDias += absDias;
        liderNode.diasEscalados += diasEscalados;
      }

      // Métricas supervisor
      supervisorNode.totalColaboradores++;
      supervisorNode.faltas += faltas;
      supervisorNode.atestados += atestado;
      supervisorNode.absDias += absDias;
      supervisorNode.diasEscalados += diasEscalados;

      // Métricas coordenador (quando presente)
      if (coordenadorNode) {
        coordenadorNode.totalColaboradores++;
        coordenadorNode.faltas += faltas;
        coordenadorNode.atestados += atestado;
        coordenadorNode.absDias += absDias;
        coordenadorNode.diasEscalados += diasEscalados;
      }

      // Métricas gerente
      gerenteNode.totalColaboradores++;
      gerenteNode.faltas += faltas;
      gerenteNode.atestados += atestado;
      gerenteNode.absDias += absDias;
      gerenteNode.diasEscalados += diasEscalados;
    });

    // =============================
    // 6️⃣ FINALIZAR ABSENTEÍSMO %
    // =============================
    const finalizarMetricas = (node) => {
      return {
        ...node,
        absenteismo:
          node.diasEscalados > 0
            ? Number(((node.absDias / node.diasEscalados) * 100).toFixed(2))
            : 0,
      };
    };

    const serializarSupervisores = (supervisoresMap) =>
      Array.from(supervisoresMap.values())
        .map((s) => {
          const supervisorFinal = finalizarMetricas(s);
          const lideresFiltrados = Array.from(s.lideres.values())
            .map((l) => finalizarMetricas(l));
          return { ...supervisorFinal, lideres: lideresFiltrados };
        })
        .filter((s) => s.totalColaboradores > 0 || s.lideres.length > 0);

    return Array.from(gerentesMap.values()).map((g) => {
      const gerenteFinal = finalizarMetricas(g);

      const coordenadoresFiltrados = Array.from(g.coordenadores.values())
        .map((coord) => {
          const coordFinal = finalizarMetricas(coord);
          return {
            ...coordFinal,
            supervisores: serializarSupervisores(coord.supervisores),
          };
        })
        .filter((coord) => coord.totalColaboradores > 0 || coord.supervisores.length > 0);

      return {
        ...gerenteFinal,
        coordenadores: coordenadoresFiltrados,
        supervisores: serializarSupervisores(g.supervisores),
      };
    });
  }

  function buildResumoHierarquia(hierarquia) {
    return {
      totalGerentes: hierarquia.length,
      totalCoordenadores: hierarquia.reduce(
        (acc, g) => acc + (g.coordenadores?.length || 0),
        0
      ),
      totalSupervisores: hierarquia.reduce(
        (acc, g) =>
          acc +
          g.supervisores.length +
          (g.coordenadores || []).reduce(
            (cAcc, coord) => cAcc + coord.supervisores.length,
            0
          ),
        0
      ),
      totalLideres: hierarquia.reduce(
        (acc, g) =>
          acc +
          g.supervisores.reduce((sAcc, s) => sAcc + s.lideres.length, 0) +
          (g.coordenadores || []).reduce(
            (cAcc, coord) =>
              cAcc +
              coord.supervisores.reduce((sAcc, s) => sAcc + s.lideres.length, 0),
            0
          ),
        0
      ),
    };
  }

/* ---------- INPUTS MANUAIS ---------- */
async function buildInputsManuais({ frequencias, colaboradoresMap }) {
  const JUSTIFICATIVA_LABEL = {
    ESQUECIMENTO_MARCACAO: "Esquecimento da marcação",
    ALTERACAO_PONTO: "Alteração de ponto",
    MARCACAO_INDEVIDA: "Marcação indevida",
    ATESTADO_MEDICO: "Atestado médico",
    SINERGIA_ENVIADA: "Sinergia enviada",
    HORA_EXTRA: "Hora extra",
    LICENCA: "Licença",
    ON: "Onboarding",
  };

  const manuais = frequencias.filter(f => f.manual === true);
  const total = manuais.length;

  // Coleta IDs únicos de quem registrou
  const registradorIds = [...new Set(
    manuais.map(f => f.registradoPor).filter(Boolean)
  )];

  // Busca nomes dos usuários
  const usuarios = await prisma.user.findMany({
    where: { id: { in: registradorIds } },
    select: { id: true, name: true },
  });
  const usuariosMap = new Map(usuarios.map(u => [u.id, u.name]));

  // Por quem registrou
  const porRegistrador = {};
  manuais.forEach(f => {
    const key = String(f.registradoPor || "sistema");
    if (!porRegistrador[key]) {
      porRegistrador[key] = {
        operador: usuariosMap.get(key) || f.registradoPor || "sistema",
        quantidade: 0,
      };
    }
    porRegistrador[key].quantidade++;
  });

  const porColaborador = Object.values(porRegistrador)
    .map(x => ({
      ...x,
      percentual: total > 0 ? Number(((x.quantidade / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Por motivo
  const porMotivo = {};
  manuais.forEach(f => {
    const key = String(f.justificativa || "SEM_JUSTIFICATIVA").toUpperCase();
    if (!porMotivo[key]) {
      porMotivo[key] = { motivo: JUSTIFICATIVA_LABEL[key] || key, quantidade: 0 };
    }
    porMotivo[key].quantidade++;
  });

  const porJustificativa = Object.values(porMotivo)
    .map(x => ({
      ...x,
      percentual: total > 0 ? Number(((x.quantidade / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return { total, porColaborador, porJustificativa };
}

/* =====================================================
   CONTROLLER — DASHBOARD ADMIN
===================================================== */
const carregarDashboardAdmin = async (req, res) => {
  try {
  /* ===============================
    📅 DATA PADRÃO = HOJE (BRASIL)
  ================================ */
  const agora = agoraBrasil();

  //  ACEITA TANTO inicio/fim QUANTO dataInicio/dataFim
  const {
    inicio,
    fim,
    dataInicio,
    dataFim,
    turno,
  } = req.query;

  // Normaliza parâmetros de data
  const inicioQuery = inicio || dataInicio;
  const fimQuery = fim || dataFim;

  let inicioFinal;
  let fimFinal;

  if (inicioQuery && fimQuery) {
    inicioFinal = new Date(inicioQuery);
    inicioFinal.setHours(0, 0, 0, 0);

    fimFinal = new Date(fimQuery);
    fimFinal.setHours(23, 59, 59, 999);
  } else {
    const base = new Date(agora);

    inicioFinal = new Date(base);
    inicioFinal.setHours(0, 0, 0, 0);

    fimFinal = new Date(base);
    fimFinal.setHours(23, 59, 59, 999);
  }

  // 🔎 DEBUG
  console.log("Query recebida:", req.query);
  console.log("Período usado:", inicioFinal, fimFinal);

  // 🔥 NORMALIZA TURNO
  const turnoSelecionado = String(turno || "ALL").toUpperCase();
  const isAll = turnoSelecionado === "ALL";

  // Filtro de estação: ADMIN global vê tudo, demais só a sua estação
  const estacaoFilter = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
    ? { idEstacao: req.dbContext.estacaoId }
    : {};

    /* ===============================
       COLABORADORES BASE
    =============================== */
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
        ...estacaoFilter,
      },
      include: {
        empresa: true,
        setor: true,
        turno: true,
        escala: true,
        cargo: true,
        lider: {
          include:  {
            lider: {
              include: {
                lider: true
              }
            }
          }
        }
      },
    });

    /* 🔥 FILTRO DE TURNO CORRETO */
    const colaboradoresTurno = isAll
      ? colaboradores
      : colaboradores.filter(
          (c) => c.turno?.nomeTurno === turnoSelecionado
        );

    const colaboradoresBase =
      !turnoSelecionado || turnoSelecionado === "ALL"
      ? colaboradores
      : colaboradores.filter(c => c.turno?.nomeTurno === turnoSelecionado);

    const colaboradoresAtivosGerais = colaboradoresTurno.filter(
      c => c.status === "ATIVO"
    );

    const totalHeadCount = colaboradoresAtivosGerais.length;
    const totalOperacao = colaboradoresAtivosGerais.filter(
      c => isCargoElegivel(c.cargo?.nomeCargo)
    ).length;

    const totalReturns = colaboradoresAtivosGerais.filter(
      c => String(c.cargo?.nomeCargo || "")
        .toUpperCase()
        .includes("RETURN")
    ).length;

    const colaboradoresFiltrados = colaboradoresBase.filter(
      c => isCargoElegivel(c.cargo?.nomeCargo)
    );

    const opsIds = colaboradoresFiltrados.map(c => c.opsId);

    if (!opsIds.length) {
      return res.json({
        success: true,
        data: {
          periodo: { inicio: isoDate(inicioFinal), fim: isoDate(fimFinal) },
          kpis: {},
          statusColaboradores: {},
          genero: [],
          empresasResumo: [],
          escalas: [],
          lideres: [],
          setores: [],
          eventos: [],
        },
      });
    }

    const colaboradoresMap = new Map(
      colaboradoresFiltrados.map(c => [c.opsId, c])
    );

    /* ===============================
       DADOS AUXILIARES
    =============================== */
/* ===============================
   BASE REAL DO PERÍODO (ESCALADOS)
=============================== */
    // Recém-desligados com cargo elegível: contam nas ausências (igual ao operacional)
    const recentlyDesligados = await prisma.colaborador.findMany({
      where: {
        status: "INATIVO",
        dataDesligamento: { gte: inicioFinal },
        cargo: { nomeCargo: { contains: "AUXILIAR DE LOGÍSTICA", mode: "insensitive" } },
        ...estacaoFilter,
      },
      select: { opsId: true },
    });
    const opsIdsDesligados = recentlyDesligados.map(c => c.opsId);

    const frequencias = await prisma.frequencia.findMany({
      where: {
        opsId: { in: [...opsIds, ...opsIdsDesligados] },
        dataReferencia: { gte: inicioFinal, lte: fimFinal },
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
    const colaboradoresPeriodo = colaboradoresFiltrados.filter(c =>
      opsIdsEscaladosPeriodo.includes(c.opsId)
    );
    
    const atestados = await prisma.atestadoMedico.findMany({
      where: {
        opsId: { in: opsIds },
        dataInicio: { lte: fimFinal },
        dataFim: { gte: inicioFinal },
        status: { in: ["ATIVO", "FINALIZADO"] },
      },
    });


    const colaboradoresEstrutura = colaboradores;
    const hierarquia = buildHierarquia({
      colaboradores: colaboradoresEstrutura,
      frequencias,
      atestados,
      inicio: inicioFinal,
      fim: fimFinal,
      turnoSelecionado: turnoSelecionado, // 🔥 ESSENCIAL
    });
    const resumoHierarquia = buildResumoHierarquia(hierarquia);

    const medidas = await prisma.medidaDisciplinar.findMany({
      where: {
        opsId: { in: opsIds },
        dataAplicacao: { gte: inicioFinal, lte: fimFinal },
      },
    });

    const acidentes = await prisma.acidenteTrabalho.findMany({
      where: {
        opsIdColaborador: { in: opsIds },
        dataOcorrencia: { gte: inicioFinal, lte: fimFinal },
      },
    });

    const desligados = await prisma.colaborador.findMany({
      where: {
        status: "INATIVO",
        dataDesligamento: { gte: inicioFinal, lte: fimFinal },
        ...estacaoFilter,
      },
    });

    const admitidos = await prisma.colaborador.findMany({
      where: {
        dataAdmissao: { gte: inicioFinal, lte: fimFinal },
        ...estacaoFilter,
      },
    });

    // Count de inativos elegíveis (cargo Auxiliar de Logística) — query separada pois não entram no fluxo principal
    const totalInativosElegiveis = await prisma.colaborador.count({
      where: {
        status: "INATIVO",
        cargo: { nomeCargo: { contains: "AUXILIAR DE LOGÍSTICA", mode: "insensitive" } },
        ...estacaoFilter,
      },
    });

    // Set de ausências já capturadas via frequencia (evita double-count com atestadoMedico)
    const ausenciasFreqSet = new Set(
      frequencias
        .filter(f => getStatusDoDia(f).impactaAbsenteismo)
        .map(f => `${f.opsId}_${new Date(f.dataReferencia).toISOString().slice(0, 10)}`)
    );

    // Expande atestados a person-days não cobertos por frequencia
    const atestadosDias = [];
    for (const a of atestados) {
      const c = colaboradoresMap.get(a.opsId);
      if (!c) continue;
      const di = new Date(Math.max(new Date(a.dataInicio).getTime(), inicioFinal.getTime()));
      const df = new Date(Math.min(new Date(a.dataFim).getTime(), fimFinal.getTime()));
      for (let d = new Date(di); d <= df; d.setUTCDate(d.getUTCDate() + 1)) {
        if ((c.escala?.diasDsr || []).includes(d.getUTCDay())) continue;
        const dataISO = d.toISOString().slice(0, 10);
        if (!ausenciasFreqSet.has(`${a.opsId}_${dataISO}`)) {
          atestadosDias.push({ opsId: a.opsId, data: dataISO, colaborador: c });
        }
      }
    }

    const overview = buildOverview({
      frequencias,
      inicio: inicioFinal,
      fim: fimFinal,
      colaboradores: colaboradoresFiltrados,
      opsIdsDesligados,
      atestadosDias,
    });

    /* ===============================
       SÉRIES MENSAIS (HC / ADMISSÕES / DESLIGAMENTOS) — TODOS (SPX + BPO)
    =============================== */
    function gerarMesesRetroativos(refDate, qtd = 12) {
      const base = new Date(refDate);
      const meses = [];
      for (let i = qtd - 1; i >= 0; i--) {
        const inicio = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59, 999);
        const label = inicio.toLocaleString("pt-BR", { month: "short" });
        const ano = inicio.getFullYear();
        meses.push({ label: `${label}/${String(ano).slice(-2)}`, inicio, fim });
      }
      return meses;
    }

    const mesesSerie = gerarMesesRetroativos(fimFinal, 12);

    // Todos os colaboradores elegíveis (cargo Auxiliar de Logística I/II, incluindo PCD)
    const whereSerieBase = {
      ...estacaoFilter,
      ...(turnoSelecionado !== "ALL"
        ? { turno: { nomeTurno: { contains: turnoSelecionado, mode: "insensitive" } } }
        : {}),
      cargo: { nomeCargo: { contains: "AUXILIAR DE LOGÍSTICA", mode: "insensitive" } },
    };

    // Colaboradores ativos para HC mensal (em memória, já temos colaboradoresFiltrados + todos)
    const todosElegiveis = await prisma.colaborador.findMany({
      where: whereSerieBase,
      select: { opsId: true, status: true, dataAdmissao: true, dataDesligamento: true },
    });

    const [headcountMensal, admissoesMensal, desligamentosMensal] = await Promise.all([
      Promise.all(
        mesesSerie.map(async (m) => {
          const total = todosElegiveis.filter((c) => {
            if (c.status !== "ATIVO") return false;
            if (!c.dataAdmissao) return false;
            if (new Date(c.dataAdmissao) > m.fim) return false;
            if (c.dataDesligamento && new Date(c.dataDesligamento) <= m.fim) return false;
            return true;
          }).length;
          return { mes: m.label, total };
        })
      ),
      Promise.all(
        mesesSerie.map(async (m) => {
          const total = await prisma.colaborador.count({
            where: { ...whereSerieBase, dataAdmissao: { gte: m.inicio, lte: m.fim } },
          });
          return { mes: m.label, total };
        })
      ),
      Promise.all(
        mesesSerie.map(async (m) => {
          const total = await prisma.colaborador.count({
            where: { ...whereSerieBase, dataDesligamento: { gte: m.inicio, lte: m.fim } },
          });
          return { mes: m.label, total };
        })
      ),
    ]);

    const diasPeriodo = daysInclusive(inicioFinal, fimFinal);
    const isMultiDia = diasPeriodo > 1;

    /* ===============================
       RESPONSE FINAL
    =============================== */
    return res.json({
      success: true,
      data: {
        periodo: {
          inicio: isoDate(inicioFinal),
          fim: isoDate(fimFinal),
        },

        kpis: {
          headcountTotal: totalHeadCount,
          headcountOperacao: totalOperacao,
          headcountReturns: totalReturns,
          totalColaboradores: overview.totalColaboradores, // contagem única (compat.)
          hcAcumulado: overview.hcAcumulado,               // pessoa-dias acumulados
          presentes: overview.presentes,
          absenteismo: overview.absenteismo,
          turnover: buildTurnoverGlobal({
            hcAcumulado: overview.hcAcumulado,
            diasPeriodo,
            admitidosPeriodo: admitidos.length,
            desligadosPeriodo: desligados.length,
          }),
          atestados: overview.absDias - overview.faltas,
          faltas: overview.faltas,
          medidasDisciplinares: medidas.length,
          acidentes: acidentes.length,
          idadeMedia: buildIdadeMedia(colaboradoresPeriodo),
          tempoMedioEmpresaDias: buildTempoMedioEmpresa(colaboradoresPeriodo),
        },

        statusColaboradores: buildStatusColaboradores({
          colaboradores: colaboradoresFiltrados,
          atestados,
          totalInativos: totalInativosElegiveis,
        }),

        genero: buildGeneroAcumulado({
          frequencias,
          colaboradores: colaboradoresFiltrados,
          inicio: inicioFinal,
          fim: fimFinal,
        }),

        empresasResumo: buildEmpresasResumo({
          colaboradores: colaboradoresFiltrados,
          colaboradoresMap,
          frequencias,
          atestados,
          atestadosDias,
          medidas,
          acidentes,
          desligados,
          admitidos,
          inicio: inicioFinal,
          fim: fimFinal,
        }),

        escalas: buildEscalasResumo({
          frequencias,
          colaboradoresMap,
          colaboradores: colaboradoresFiltrados,
          inicio: inicioFinal,
          fim: fimFinal,
          atestadosDias,
        }),

        setores: buildSetoresResumo({
          frequencias,
          colaboradoresMap,
          colaboradores: colaboradoresFiltrados,
          inicio: inicioFinal,
          fim: fimFinal,
          atestadosDias,
        }),

        lideres: buildLideresResumo({
          frequencias,
          colaboradoresMap,
          colaboradores: colaboradoresFiltrados,
          inicio: inicioFinal,
          fim: fimFinal,
          atestadosDias,
        }),
        hierarquia,
        resumoHierarquia,

        inputsManuais: await buildInputsManuais({
          frequencias,
          colaboradoresMap,
        }),

        faltasPorTempoCasa: buildFaltasPorTempoCasa({
          frequencias,
          colaboradoresMap,
        }),

        eventos: buildEventos({
          colaboradoresMap,
          atestados,
          acidentes,
          medidas,
        }),

        series: {
          headcountMensal,
          admissoesMensal,
          desligamentosMensal,
          // Série diária: apenas para períodos > 1 dia (modo consolidado)
          diaria: isMultiDia
            ? buildSeriesDiarias({ todosElegiveis, inicio: inicioFinal, fim: fimFinal })
            : null,
        },
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
