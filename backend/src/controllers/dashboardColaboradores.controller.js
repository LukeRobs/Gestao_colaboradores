const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { getDateOperacional } = require("../utils/dateOperacional");

/* =====================================================
   ⏰ TIMEZONE FIXO — BRASIL
===================================================== */
function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(spString);
}

/* =====================================================
   HELPERS
===================================================== */
const normalize = (v) => String(v || "").trim();

const normalizeTurno = (t) => {
  const v = normalize(t).toUpperCase();
  if (v.includes("T1") || v === "1" || v.includes("TURNO 1") || v.includes("TURN 1")) return "T1";
  if (v.includes("T2") || v === "2" || v.includes("TURNO 2") || v.includes("TURN 2")) return "T2";
  if (v.includes("T3") || v === "3" || v.includes("TURNO 3") || v.includes("TURN 3")) return "T3";
  return "Sem turno";
};

function safeDate(d) {
  if (!(d instanceof Date)) return null;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toISODateStr(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/** diferença em dias */
function diffDays(start, end) {
  return Math.floor((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
}

/** idade */
function calcIdade(nascimento, ref) {
  const n = new Date(nascimento);
  const r = new Date(ref);
  let idade = r.getFullYear() - n.getFullYear();
  const m = r.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < n.getDate())) idade--;
  return idade;
}

/** Cargo elegível (igual operacional/admin) */
function isCargoElegivel(cargo) {
  const nome = String(cargo || "").toUpperCase();
  if (nome.includes("PCD")) return false;
  return (
    nome.includes("AUXILIAR DE LOGÍSTICA I") ||
    nome.includes("AUXILIAR DE LOGÍSTICA II") ||
    nome.includes("AUXILIAR DE LOGÍSTICA")
  );
}

/** DSR por escala A/B/C (igual teu operacional) */
function isDiaDSR(dataOperacional, nomeEscala) {
  const dow = new Date(dataOperacional).getDay();
  const dsrMap = {
    A: [0, 3], // domingo, quarta
    B: [1, 2], // segunda, terça
    C: [4, 5], // quinta, sexta
  };
  const dias = dsrMap[String(nomeEscala || "").toUpperCase()];
  return !!dias?.includes(dow);
}

/** resolve snapshot (dia fim do range) */
function resolveSnapshotDate({ dataInicio, dataFim, dataOperacional }) {
  if (dataFim) return toISODateStr(dataFim);
  if (dataInicio) return toISODateStr(dataInicio);
  return toISODateStr(dataOperacional);
}

/** dias úteis do período (exclui DSR) */
function getDiasUteisPeriodo(inicio, fim, escala) {
  const dias = [];
  const d = new Date(inicio);
  const end = new Date(fim);
  end.setHours(23, 59, 59, 999);

  while (d <= end) {
    if (!isDiaDSR(d, escala)) dias.push(toISODateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

/* =====================================================
   STATUS DO DIA — MESMA LÓGICA DO OPERACIONAL/ADMIN
   (contaComoEscalado + impactaAbsenteismo)
===================================================== */
function getStatusDoDiaOperacional(f) {
  // Presença
  if (f?.horaEntrada) {
    return {
      label: "Presente",
      contaComoEscalado: true,
      impactaAbsenteismo: false,
      origem: "horaEntrada",
    };
  }

  // Ausência registrada (tipoAusencia)
  if (f?.tipoAusencia) {
    const codigo = String(f.tipoAusencia.codigo || "").toUpperCase();
    const desc = String(f.tipoAusencia.descricao || "").toUpperCase();

    // NC -> não contratado (fora do HC)
    if (codigo === "NC") {
      return { label: "Não contratado", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }

    // ON -> onboarding (fora do HC)
    if (codigo === "ON") {
      return { label: "Onboarding", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }

    // FO -> entra no HC apto, não impacta
    if (codigo === "FO") {
      return { label: "Folga", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }

    // DSR -> fora do HC
    if (codigo === "DSR") {
      return { label: "Folga", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }

    // Férias -> fora do HC
    if (codigo === "FE" || desc.includes("FÉRIAS")) {
      return { label: "Férias", contaComoEscalado: false, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }

    // Atestado
    if (codigo === "AM" || desc.includes("ATEST")) {
      return { label: "Atestado Médico", contaComoEscalado: true, impactaAbsenteismo: true, origem: "tipoAusencia" };
    }

    // Sinergia enviada -> entra no HC apto, não impacta
    if (codigo === "S1" || desc.includes("SINERGIA")) {
      return { label: "Sinergia Enviada", contaComoEscalado: true, impactaAbsenteismo: false, origem: "tipoAusencia" };
    }

    // Qualquer outra ausência vira Falta (impacta)
    return { label: "Falta", contaComoEscalado: true, impactaAbsenteismo: true, origem: "tipoAusencia" };
  }

  // fallback se existir registro sem entrada/tipoAusencia
  return { label: "Falta", contaComoEscalado: true, impactaAbsenteismo: true, origem: "semRegistro" };
}

/* =====================================================
   FAIXA TEMPO EMPRESA — DONUT PREMIUM
===================================================== */
function getFaixaTempoEmpresaPremium(adm, ref) {
  if (!adm || !ref) return "N/I";
  const dias = diffDays(adm, ref);

  if (dias < 180) return "0–6 meses";
  if (dias < 365) return "6–12 meses";
  if (dias < 730) return "1–2 anos";
  if (dias < 1095) return "2–3 anos";
  return "3+ anos";
}

/* =====================================================
   SERIES (MESES)
===================================================== */
function gerarMesesRetroativos(refDate, qtd = 12) {
  const base = new Date(refDate);
  const meses = [];

  for (let i = qtd - 1; i >= 0; i--) {
    const inicio = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59, 999);

    const label = inicio.toLocaleString("pt-BR", { month: "short" }); // "fev", "mar"...
    const ano = inicio.getFullYear();

    meses.push({
      key: `${ano}-${String(inicio.getMonth() + 1).padStart(2, "0")}`,
      label: `${label}/${String(ano).slice(-2)}`,
      inicio,
      fim,
    });
  }

  return meses;
}

/* =====================================================
   CONTROLLER — DASHBOARD COLABORADORES (EXECUTIVO)
===================================================== */
const carregarDashboardColaboradores = async (req, res) => {
  try {
    const {
      data,
      dataInicio,
      dataFim,
      turno,
      lider,
      escala,
      search,
      page = 1,
      pageSize = 50,
      months = 12, // série mensal padrão
    } = req.query;

    /* ===============================
       1) DATAS / PERÍODO
    =============================== */
    const agora = agoraBrasil();
    const { dataOperacional, dataOperacionalStr, turnoAtual } = getDateOperacional(agora);

    let inicio;
    let fim;

    if (dataInicio && dataFim) {
      inicio = safeDate(new Date(`${dataInicio}T00:00:00.000Z`));
      fim = safeDate(new Date(`${dataFim}T23:59:59.999Z`));
    } else if (data) {
      inicio = safeDate(new Date(`${data}T00:00:00.000Z`));
      fim = safeDate(new Date(`${data}T23:59:59.999Z`));
    } else {
      const base = new Date(dataOperacional).toISOString().slice(0, 10);
      inicio = safeDate(new Date(`${base}T00:00:00.000Z`));
      fim = safeDate(new Date(`${base}T23:59:59.999Z`));
    }

    if (!inicio || !fim) {
      const h = agoraBrasil();
      inicio = new Date(h.setHours(0, 0, 0, 0));
      fim = new Date(h.setHours(23, 59, 59, 999));
    }

    if (inicio > fim) {
      const tmp = inicio;
      inicio = fim;
      fim = tmp;
    }

    const snapshotStr = resolveSnapshotDate({ dataInicio: inicio, dataFim: fim, dataOperacional });
    const periodo = { inicio: toISODateStr(inicio), fim: toISODateStr(fim) };

    /* ===============================
       2) WHERE BASE (filtros estruturais)
       - aplicado em colaboradores e nas séries mensais
    =============================== */
    const turnoNormFiltro = turno ? normalizeTurno(turno) : null;

    const whereColabBase = {
      ...(lider
        ? { lider: { nomeCompleto: { equals: lider, mode: "insensitive" } } }
        : {}),
      ...(escala ? { escala: { nomeEscala: escala } } : {}),
      ...(search
        ? {
            OR: [
              { nomeCompleto: { contains: search, mode: "insensitive" } },
              { opsId: { contains: search } },
              { cpf: { contains: search } },
            ],
          }
        : {}),
    };

    /* ===============================
       3) QUERIES (1x colaboradores, 1x frequencias período)
       - colaboradores: pegamos tudo (inclusive desligado) porque KPI/HC precisa
       - frequencias: período inteiro (para absenteísmo e ranking)
    =============================== */
    const [colaboradoresAll, frequenciasPeriodo] = await Promise.all([
      prisma.colaborador.findMany({
        where: whereColabBase,
        include: {
          empresa: true,
          turno: true,
          setor: true,
          escala: true,
          cargo: true,
          lider: true,
        },
      }),

      prisma.frequencia.findMany({
        where: { dataReferencia: { gte: inicio, lte: fim } },
        include: { tipoAusencia: true, setor: true },
        orderBy: { dataReferencia: "asc" },
      }),
    ]);

    /* ===============================
       4) MAPAS (performance)
    =============================== */
    const colabByOps = new Map(colaboradoresAll.map((c) => [c.opsId, c]));

    const freqMap = new Map();
    frequenciasPeriodo.forEach((f) => {
      if (!freqMap.has(f.opsId)) freqMap.set(f.opsId, []);
      freqMap.get(f.opsId).push(f);
    });

    /* ===============================
       5) UNIVERSO FILTRADO (igual operacional/admin)
       - elegíveis: cargo + turno != sem turno
       - turno filtro (se veio)
       - DESLIGADO entra para KPI desligados + séries, mas não entra no absenteísmo do período (igual seu padrão operacional)
    =============================== */
    // Empresas BPO (Dashboard Colaboradores exibe apenas BPO, sem SPX)
    const BPO_EMPRESAS = ["ADECCO", "ADILIS", "LUANDRE"];
    const isBPO = (c) =>
      BPO_EMPRESAS.includes(
        String(c.empresa?.razaoSocial || "").toUpperCase()
      );

    const colaboradoresElegiveis = colaboradoresAll.filter((c) => {
      const t = normalizeTurno(c.turno?.nomeTurno);
      if (turnoNormFiltro && t !== turnoNormFiltro) return false;

      // desligado pode ficar no universo para métricas de desligamento/HC
      // mas para presença/abs do período a gente avalia separado
      if (c.status !== "ATIVO") return false;

      if (!isCargoElegivel(c.cargo?.nomeCargo)) return false;
      if (t === "Sem turno") return false;

      // Apenas BPO
      if (!isBPO(c)) return false;

      return true;
    });

/* ===============================
   6) KPIs + DISTRIBUIÇÕES + TABELA
=============================== */
const kpis = {
  ativos: 0,
  presentes: 0,
  ausentes: 0,
  atrasos: 0,
  inativos: 0,

  mediaIdade: 0,
  tempoMedioEmpresa: 0,

  absenteismoPeriodo: 0,
  hcAptoDias: 0,
  ausenciasDias: 0,
};

/* ===============================
   DISTRIBUIÇÕES (DONUTS)
=============================== */
const tempoEmpresaDistribuicao = {};
const generoDistribuicao = {};
const turnoDistribuicao = {};

const setorGenero = {};
const porTurno = {};
const porEscala = {};
const hcPorLider = {};
const hcPorSetor = {};


let somaIdade = 0,
  qtdIdade = 0,
  somaTempoEmpresaDias = 0,
  qtdTempoEmpresa = 0;

const linhas = [];
const diasUteisCache = new Map();

/* ===============================
   LOOP PRINCIPAL
=============================== */
colaboradoresElegiveis.forEach((c) => {
  const turnoNorm = normalizeTurno(c.turno?.nomeTurno);

  // DESLIGADO
  if (c.status === "INATIVO") {
    kpis.inativos++;
    return;
  }

// Apenas ATIVOS
if (!isCargoElegivel(c.cargo?.nomeCargo)) return;
kpis.ativos++;


const registros = freqMap.get(c.opsId) || [];

// ✅ DSR: não remove do universo (donuts), só bloqueia presença/tabela
const isDsrHoje = !!(c.escala?.nomeEscala && isDiaDSR(fim, c.escala.nomeEscala));

const nomeLider = c.lider?.nomeCompleto || "Sem Líder";
const nomeSetor = c.setor?.nomeSetor || "Sem Setor";

hcPorLider[nomeLider] = (hcPorLider[nomeLider] || 0) + 1;
hcPorSetor[nomeSetor] = (hcPorSetor[nomeSetor] || 0) + 1;

  const registroSnapshot =
    registros.find((r) => toISODateStr(r.dataReferencia) === snapshotStr) || null;

  const esc = c.escala?.nomeEscala || "";
  if (!diasUteisCache.has(esc)) {
    diasUteisCache.set(esc, getDiasUteisPeriodo(inicio, fim, esc));
  }
  const diasUteis = diasUteisCache.get(esc);
  const totalDiasUteis = diasUteis.length;

  const freqMapDia = new Map(registros.map((r) => [toISODateStr(r.dataReferencia), r]));

  /* ===============================
     PRESENÇA / AUSÊNCIA
  =============================== */
  if (!isDsrHoje) {
  if (totalDiasUteis <= 1) {
    const s = getStatusDoDiaOperacional(registroSnapshot);

    if (s.label === "Presente") {
      kpis.presentes++;
    } else if (s.impactaAbsenteismo) {
      kpis.ausentes++;
    }
  } else {
    const diasTrabalhados = diasUteis.filter((dia) => {
      const reg = freqMapDia.get(dia);
      return !!reg?.horaEntrada;
    }).length;

    if (diasTrabalhados === totalDiasUteis) {
      kpis.presentes++;
    } else if (diasTrabalhados === 0) {
      kpis.ausentes++;
    }
  }
}
  /* ===============================
     MÉTRICAS
  =============================== */
  if (c.dataNascimento) {
    somaIdade += calcIdade(c.dataNascimento, fim);
    qtdIdade++;
  }

  if (c.dataAdmissao) {
    const diasEmpresa = diffDays(c.dataAdmissao, fim);
    somaTempoEmpresaDias += diasEmpresa;
    qtdTempoEmpresa++;

    const faixa = getFaixaTempoEmpresaPremium(c.dataAdmissao, fim);
    tempoEmpresaDistribuicao[faixa] =
      (tempoEmpresaDistribuicao[faixa] || 0) + 1;
  }

  /* ===============================
     DONUT GÊNERO
  =============================== */
  const genero = (c.genero || "N/I").toUpperCase();

  if (genero.startsWith("M")) {
    generoDistribuicao["Masculino"] =
      (generoDistribuicao["Masculino"] || 0) + 1;
  } else if (genero.startsWith("F")) {
    generoDistribuicao["Feminino"] =
      (generoDistribuicao["Feminino"] || 0) + 1;
  } else {
    generoDistribuicao["N/I"] =
      (generoDistribuicao["N/I"] || 0) + 1;
  }

  /* ===============================
     DONUT TURNO
  =============================== */
  if (turnoNorm !== "Sem turno") {
    turnoDistribuicao[turnoNorm] =
      (turnoDistribuicao[turnoNorm] || 0) + 1;
  }

  /* ===============================
     DISTRIBUIÇÕES EXISTENTES
  =============================== */
  const setor = c.setor?.nomeSetor || "Sem setor";

  setorGenero[setor] ??= { masculino: 0, feminino: 0, total: 0 };
  if (genero.startsWith("M")) setorGenero[setor].masculino++;
  if (genero.startsWith("F")) setorGenero[setor].feminino++;
  setorGenero[setor].total++;

  porTurno[turnoNorm] = (porTurno[turnoNorm] || 0) + 1;
  porEscala[c.escala?.nomeEscala || "Sem escala"] =
    (porEscala[c.escala?.nomeEscala || "Sem escala"] || 0) + 1;

  const sTabela = getStatusDoDiaOperacional(registroSnapshot);

  linhas.push({
    colaborador: c.nomeCompleto,
    opsId: c.opsId,
    cpf: c.cpf || null,
    lider: c.lider?.nomeCompleto || "-",
    empresa: c.empresa?.razaoSocial || "-",
    setor,
    turno: turnoNorm,
    escala: c.escala?.nomeEscala || "-",
    status: sTabela.label,
  });
});

function buildHcRanking(map) {
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

const hcLiderRanking = buildHcRanking(hcPorLider);
const hcSetorRanking = buildHcRanking(hcPorSetor);
const hcEscalaRanking = buildHcRanking(porEscala);



/* ===============================
   MÉDIAS FINAIS
=============================== */
kpis.mediaIdade = qtdIdade
  ? +(somaIdade / qtdIdade).toFixed(1)
  : 0;

kpis.tempoMedioEmpresa = qtdTempoEmpresa
  ? +((somaTempoEmpresaDias / qtdTempoEmpresa) / 365).toFixed(1)
  : 0;

    /* ===============================
       6.1) ABSENTEÍSMO DO PERÍODO (IGUAL OPERACIONAL/ADMIN)
       - totalHcAptoDias: soma de dias contaComoEscalado
       - totalAusenciasDias: soma de dias impactaAbsenteismo
       - respeita: cargo elegível + filtro de turno
    =============================== */
    let totalHcAptoDias = 0;
    let totalAusenciasDias = 0;

    frequenciasPeriodo.forEach((f) => {
      const c = colabByOps.get(f.opsId);
      if (!c) return;

      const turnoColab = normalizeTurno(c.turno?.nomeTurno);
      if (turnoNormFiltro && turnoColab !== turnoNormFiltro) return;

      // só ativos e elegíveis como no operacional/admin
      if (c.status !== "ATIVO") return;
      if (!isCargoElegivel(c.cargo?.nomeCargo)) return;
      if (turnoColab === "Sem turno") return;
      // Apenas BPO
      if (!isBPO(c)) return;

      const s = getStatusDoDiaOperacional(f);

      if (s.contaComoEscalado) totalHcAptoDias++;
      if (s.impactaAbsenteismo) totalAusenciasDias++;
    });

    kpis.hcAptoDias = totalHcAptoDias;
    kpis.ausenciasDias = totalAusenciasDias;

    kpis.absenteismoPeriodo =
      totalHcAptoDias > 0 ? Number(((totalAusenciasDias / totalHcAptoDias) * 100).toFixed(2)) : 0;

    /* ===============================
       7) TOP RANKINGS (FALTAS / ATESTADOS) NO PERÍODO
       - usa MESMA regra do operacional/admin (status do dia na frequência)
    =============================== */
    const faltasByOps = new Map();
    const atestByOps = new Map();

    frequenciasPeriodo.forEach((f) => {

      if (!f) return; // 🔒 proteção absoluta

      const c = colabByOps.get(f.opsId);
      if (!c) return;

      const turnoColab = normalizeTurno(c.turno?.nomeTurno);
      if (turnoNormFiltro && turnoColab !== turnoNormFiltro) return;

      if (c.status !== "ATIVO") return;
      if (!isCargoElegivel(c.cargo?.nomeCargo)) return;
      if (turnoColab === "Sem turno") return;
      // Apenas BPO
      if (!isBPO(c)) return;

      // 🔴 FALTAS (usando campo correto do Prisma)
      if (f.idTipoAusencia === 3 || f.idTipoAusencia === 32) {
        faltasByOps.set(f.opsId, (faltasByOps.get(f.opsId) || 0) + 1);
      }

      // 🟡 ATESTADOS
      if (f.tipoAusencia?.codigo === "AM") {
        atestByOps.set(f.opsId, (atestByOps.get(f.opsId) || 0) + 1);
      }
    });

    

    function buildTop(map, limit = 10) {
      return Array.from(map.entries())
        .map(([opsId, qtd]) => {
          const c = colabByOps.get(opsId);
          return {
            opsId,
            colaborador: c?.nomeCompleto || opsId,
            lider: c?.lider?.nomeCompleto || "-",
            empresa: c?.empresa?.razaoSocial || c?.empresa?.nomeEmpresa || "-",
            turno: normalizeTurno(c?.turno?.nomeTurno),
            qtd: Number(qtd || 0),
          };
        })
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, limit);
    }

    const topFaltas = buildTop(faltasByOps, 10);
    const topAtestados = buildTop(atestByOps, 10);
    /* ===============================
      TURNOVER DO PERÍODO (CORRIGIDO)
      Fórmula: Desligamentos / HC médio do período
    ================================ */

    // 🔴 1) Total de desligamentos no período (respeita filtros)
    const desligamentosPeriodo = await prisma.colaborador.count({
      where: {
        ...whereColabBase,
        ...(turnoNormFiltro
          ? { turno: { nomeTurno: { contains: turnoNormFiltro, mode: "insensitive" } } }
          : {}),
        empresa: {
          razaoSocial: { in: ["ADECCO", "ADILIS", "LUANDRE"], mode: "insensitive" },
        },
        dataDesligamento: {
          gte: inicio,
          lte: fim,
        },
      },
    });

    // 🟢 2) Headcount no INÍCIO do período
    const headcountInicio = colaboradoresElegiveis.filter((c) => {
      if (c.status !== "ATIVO") return false;
      if (!c.dataAdmissao) return false;

      const admissao = new Date(c.dataAdmissao);
      if (admissao > inicio) return false;

      if (c.dataDesligamento) {
        const deslig = new Date(c.dataDesligamento);
        if (deslig <= inicio) return false;
      }

      return true;
    }).length;

    // 🟢 3) Headcount no FIM do período
    const headcountFim = kpis.ativos;

    // 📊 4) Headcount médio
    const headcountMedio = (headcountInicio + headcountFim) / 2;

    // 📈 5) Turnover final
    kpis.turnover =
      headcountMedio > 0
        ? Number(((desligamentosPeriodo / headcountMedio) * 100).toFixed(2))
        : 0;




    /* ===============================
       8) SÉRIES MENSAIS (HC / ADMISSÕES / DESLIGAMENTOS)
       - HC real no fim do mês
       - adm/desl por mês
       - respeita filtros base (lider/escala/search) + turno filtro
       - respeita cargo elegível? (sim, para ficar alinhado ao operacional/admin)
    =============================== */
    const monthsNum = Math.min(Math.max(Number(months) || 12, 3), 36); // 3..36
    const mesesSerie = gerarMesesRetroativos(fim, monthsNum);

    // where base para contagens:
    // - aplica filtros do front (lider/escala/search)
    // - aplica turno
    // - aplica cargo elegível (via OR contains em JS não é possível direto)
    //   => aqui a gente filtra por "nomeCargo contains AUXILIAR..." de forma simples
    //   (melhor: você normalizar cargo ou ter flag elegivel no banco)
    const whereCountBase = {
      ...whereColabBase,
      ...(turnoNormFiltro
        ? { turno: { nomeTurno: { contains: turnoNormFiltro, mode: "insensitive" } } }
        : {}),
      cargo: {
        nomeCargo: { contains: "AUXILIAR DE LOGÍSTICA", mode: "insensitive" },
      },
      // não conta PCD
      NOT: [{ cargo: { nomeCargo: { contains: "PCD", mode: "insensitive" } } }],
      // Apenas BPO (sem SPX)
      empresa: {
        razaoSocial: { in: ["ADECCO", "ADILIS", "LUANDRE"], mode: "insensitive" },
      },
    };

    const [headcountMensal, admissoesMensal, desligamentosMensal] = await Promise.all([
      Promise.all(
        mesesSerie.map(async (m) => {
          const total = colaboradoresElegiveis.filter((c) => {
            if (c.status !== "ATIVO") return false;
            if (!c.dataAdmissao) return false;

            const admissao = new Date(c.dataAdmissao);
            if (admissao > m.fim) return false;

            if (c.dataDesligamento) {
              const deslig = new Date(c.dataDesligamento);
              if (deslig <= m.fim) return false;
            }

            return true;
          }).length;

          return { mes: m.label, total };
        })
      ),

      Promise.all(
        mesesSerie.map(async (m) => {
          const total = await prisma.colaborador.count({
            where: {
              ...whereCountBase,
              dataAdmissao: { gte: m.inicio, lte: m.fim },
            },
          });
          return { mes: m.label, total };
        })
      ),

      Promise.all(
        mesesSerie.map(async (m) => {
          const total = await prisma.colaborador.count({
            where: {
              ...whereCountBase,
              dataDesligamento: { gte: m.inicio, lte: m.fim },
            },
          });
          return { mes: m.label, total };
        })
      ),
    ]);

    /* ===============================
       8.1) CANDIDATOS À INTERNALIZAÇÃO
       Critérios (desde a admissão):
       - BPO, ATIVO, cargo elegível
       - Mais de 90 dias de casa
       - Sem atestados médicos
       - Sem faltas (idTipoAusencia 3 ou 32 na frequência)
       - Sem medidas disciplinares
    =============================== */
    const noventa_dias_atras = new Date();
    noventa_dias_atras.setDate(noventa_dias_atras.getDate() - 90);

    const [opsComAtestado, opsComFalta, opsComMedida] = await Promise.all([
      prisma.atestadoMedico.groupBy({
        by: ["opsId"],
        where: { opsId: { in: colaboradoresElegiveis.map(c => c.opsId) } },
        _count: { opsId: true },
      }),
      prisma.frequencia.groupBy({
        by: ["opsId"],
        where: {
          opsId: { in: colaboradoresElegiveis.map(c => c.opsId) },
          idTipoAusencia: { in: [3, 32] },
        },
        _count: { opsId: true },
      }),
      prisma.medidaDisciplinar.groupBy({
        by: ["opsId"],
        where: { opsId: { in: colaboradoresElegiveis.map(c => c.opsId) } },
        _count: { opsId: true },
      }),
    ]);

    // Maps opsId → contagem
    const mapAtestado = new Map(opsComAtestado.map(r => [r.opsId, r._count.opsId]));
    const mapFalta    = new Map(opsComFalta.map(r => [r.opsId, r._count.opsId]));
    const mapMedida   = new Map(opsComMedida.map(r => [r.opsId, r._count.opsId]));

    const setAtestado = new Set(mapAtestado.keys());
    const setFalta    = new Set(mapFalta.keys());
    const setMedida   = new Set(mapMedida.keys());

    const mapColabBase = (c) => ({
      opsId: c.opsId,
      nome: c.nomeCompleto,
      empresa: c.empresa?.razaoSocial || "-",
      turno: normalizeTurno(c.turno?.nomeTurno),
      setor: c.setor?.nomeSetor || "-",
      lider: c.lider?.nomeCompleto || "-",
      diasCasa: Math.floor((new Date() - new Date(c.dataAdmissao)) / 86400000),
      dataAdmissao: toISODateStr(c.dataAdmissao),
      // contagens (0 quando não tem)
      qtdFaltas:   mapFalta.get(c.opsId)    || 0,
      qtdAtestados: mapAtestado.get(c.opsId) || 0,
      qtdMedidas:  mapMedida.get(c.opsId)   || 0,
    });

    // Colaboradores com +90 dias de casa
    const acima90dias = colaboradoresElegiveis.filter(c => {
      if (!c.dataAdmissao) return false;
      return Math.floor((new Date() - new Date(c.dataAdmissao)) / 86400000) > 90;
    });

    // Passou nos critérios: +90 dias + sem falta + sem medida + máximo 1 atestado
    // Exclui quem tem 0 atestados também (esses já aparecem em candidatosInternalizacao)
    const semFaltaComTempo = acima90dias
      .filter(c => !setFalta.has(c.opsId) && !setMedida.has(c.opsId) && (mapAtestado.get(c.opsId) || 0) === 1)
      .map(mapColabBase)
      .sort((a, b) => b.diasCasa - a.diasCasa);

    // Passou só no tempo de casa, mas reprovado em falta/atestado/medida
    const reprovadosComTempo = acima90dias
      .filter(c => setFalta.has(c.opsId) || (mapAtestado.get(c.opsId) || 0) > 1 || setMedida.has(c.opsId))
      .map(c => ({
        ...mapColabBase(c),
        motivos: [
          setFalta.has(c.opsId)                        ? "Falta"              : null,
          (mapAtestado.get(c.opsId) || 0) > 1          ? "Atestado"           : null,
          setMedida.has(c.opsId)                       ? "Medida Disciplinar" : null,
        ].filter(Boolean),
      }))
      .sort((a, b) => b.diasCasa - a.diasCasa);

    const candidatosInternalizacao = colaboradoresElegiveis
      .filter(c => {
        if (!c.dataAdmissao) return false;
        const diasCasa = Math.floor((new Date() - new Date(c.dataAdmissao)) / 86400000);
        if (diasCasa <= 90) return false;
        if (setAtestado.has(c.opsId)) return false;
        if (setFalta.has(c.opsId)) return false;
        if (setMedida.has(c.opsId)) return false;
        return true;
      })
      .map(mapColabBase)
      .sort((a, b) => b.diasCasa - a.diasCasa);

    /* ===============================
       9) PAGINAÇÃO TABELA
    =============================== */
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 50;

    const totalLinhas = linhas.length;
    const colaboradoresPage = linhas.slice((p - 1) * ps, p * ps);

    /* ===============================
       10) RESPONSE
    =============================== */
    return res.json({
      success: true,
      data: {
        dataOperacional: dataOperacionalStr,
        turnoAtual,
        snapshotDate: snapshotStr,
        periodo,

        kpis,

        // ✅ blocos executivos (praquele dashboard)
        series: {
          headcountMensal,        // evolução HC (linha)
          admissoesMensal,        // barras/linha
          desligamentosMensal,    // barras/linha
        },

        donut: {
          tempoEmpresaDistribuicao,
          generoDistribuicao,
          turnoDistribuicao,
        },

        hc: {
          hcPorLider: hcLiderRanking,
          hcPorSetor: hcSetorRanking,
          hcPorEscala: hcEscalaRanking,
        },

        rankings: {
          topFaltas,
          topAtestados,
        },

        candidatosInternalizacao,
        semFaltaComTempo,
        reprovadosComTempo,

        distribuicoes: {
          setorGenero,
          colaboradorPorTurno: porTurno,
          colaboradorPorEscala: porEscala,
        },

        colaboradores: colaboradoresPage,

        pagination: {
          page: p,
          pageSize: ps,
          total: totalLinhas,
        },
      },
    });
  } catch (err) {
    console.error("❌ Erro dashboard colaboradores:", err);
    res.status(500).json({ success: false });
  }
};

module.exports = { carregarDashboardColaboradores };
