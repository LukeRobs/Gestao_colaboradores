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

/**
 * TIME (Postgres) no Prisma costuma vir como Date (1970-01-01T..)
 * ou pode vir string dependendo de setup. Aceita ambos.
 */
function timeToMinutes(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes();
  }

  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    return h * 60 + min;
  }

  return null;
}

function diffDays(start, end) {
  return Math.floor((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
}

function getFaixaTempoEmpresa(adm, ref) {
  if (!adm || !ref) return "N/I";
  const dias = diffDays(adm, ref);
  if (dias < 30) return "< 30 dias";
  if (dias < 90) return "30–89 dias";
  return "≥ 90 dias";
}

function calcIdade(nascimento, ref) {
  const n = new Date(nascimento);
  const r = new Date(ref);
  let idade = r.getFullYear() - n.getFullYear();
  const m = r.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < n.getDate())) idade--;
  return idade;
}

function isCargoElegivel(cargo) {
  const nome = String(cargo || "").toUpperCase();
  // Exclui PCD da contagem
  if (nome.includes("PCD")) {
    return false;
  }
  // use a mesma regra do dashboard operacional (I e II)
  return nome.includes("AUXILIAR DE LOGÍSTICA I") || nome.includes("AUXILIAR DE LOGÍSTICA II") || nome.includes("AUXILIAR DE LOGÍSTICA");
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

/** status base (sem atraso) */
function getStatusBase(registro) {
  if (registro?.horaEntrada) return { status: "PRESENTE", origem: "horaEntrada" };

  if (registro?.idTipoAusencia) {
    return {
      status: normalize(registro.tipoAusencia?.descricao || "AUSÊNCIA"),
      origem: "tipoAusencia",
    };
  }

  return { status: "FALTA", origem: "semRegistro" };
}

/** ausência válida (igual operacional) */
function isAusenciaValida(status) {
  const s = String(status || "").toUpperCase();
  const invalidos = [
    "PRESENTE",
    "PRESENÇA",
    "DSR",
    "DESCANSO",
    "FOLGA",
    "BANCO DE HORAS",
    "TREINAMENTO",
  ];
  return !invalidos.some((v) => s.includes(v));
}

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

/** monta status final do dia (PRESENTE / ATRASO / motivo / FALTA) */
function getStatusDoDia(registro, colaborador) {
  const { status, origem } = getStatusBase(registro);

  if (status !== "PRESENTE") return { status, origem };

  // tenta atraso se tiver jornada + entrada
  const toleranciaMin = 5;

  const entradaMin = timeToMinutes(registro?.horaEntrada);

  // ⚠️ Prisma: campo é camelCase -> horarioInicioJornada
  const jornadaMin =
    timeToMinutes(colaborador?.horarioInicioJornada) ??
    timeToMinutes(colaborador?.horario_inicio_jornada) ?? // fallback se em algum ponto vier snake
    null;

  if (entradaMin != null && jornadaMin != null && entradaMin > jornadaMin + toleranciaMin) {
    return { status: "ATRASO", origem: "horaEntrada" };
  }

  return { status: "PRESENTE", origem };
}

/* =====================================================
   CONTROLLER
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

    const snapshotStr = resolveSnapshotDate({
      dataInicio: inicio,
      dataFim: fim,
      dataOperacional,
    });

    /* ===============================
       2) QUERIES (no padrão do operacional)
       - colaboradores (com filtros estruturais e do front)
       - frequencias do período (1 query)
    =============================== */
    const [colaboradores, frequenciasPeriodo] = await Promise.all([
      prisma.colaborador.findMany({
        where: {
          ...(lider
            ? {
                lider: {
                  nomeCompleto: { equals: lider, mode: "insensitive" },
                },
              }
            : {}),

          ...(escala
            ? {
                escala: { nomeEscala: escala },
              }
            : {}),

          ...(search
            ? {
                OR: [
                  { nomeCompleto: { contains: search, mode: "insensitive" } },
                  { opsId: { contains: search } },
                  { cpf: { contains: search } },
                ],
              }
            : {}),
        },
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
        where: {
          dataReferencia: { gte: inicio, lte: fim },
        },
        include: {
          tipoAusencia: true,
          setor: true,
        },
        orderBy: { dataReferencia: "asc" },
      }),
    ]);

    /* ===============================
       3) MAPA DE FREQUÊNCIAS (opsId -> registros[])
    =============================== */
    const freqMap = new Map();
    frequenciasPeriodo.forEach((f) => {
      if (!freqMap.has(f.opsId)) freqMap.set(f.opsId, []);
      freqMap.get(f.opsId).push(f);
    });

    /* ===============================
       4) APLICA FILTRO DE TURNO + CARGO (igual operacional)
       - desligado não precisa passar por cargo (pra KPI)
    =============================== */
    const colaboradoresFiltrados = colaboradores.filter((c) => {
      const turnoNorm = normalizeTurno(c.turno?.nomeTurno);

      if (turno && turnoNorm !== normalizeTurno(turno)) return false;

      // deixa desligado passar só pra contagem KPI (se quiser listar desligado, tratamos no loop)
      if (c.status === "DESLIGADO") return true;

      if (!isCargoElegivel(c.cargo?.nomeCargo)) return false;
      if (turnoNorm === "Sem turno") return false;

      return true;
    });

    /* ===============================
       5) ESTRUTURAS
    =============================== */
    const kpis = {
      ativos: 0,
      presentes: 0,
      ausentes: 0,
      atrasos: 0,
      desligados: 0,
      mediaIdade: 0,
      tempoMedioEmpresa: 0,
    };

    const setorGenero = {};
    const porTurno = {};
    const porEscala = {};

    let somaIdade = 0,
      qtdIdade = 0,
      somaTempoEmpresa = 0,
      qtdTempoEmpresa = 0;

    const linhas = [];

    /* ===============================
       6) LOOP PRINCIPAL (no padrão do operacional)
    =============================== */
    const diasUteisCache = new Map(); // escala -> dias uteis

    colaboradoresFiltrados.forEach((c) => {
      const turnoNorm = normalizeTurno(c.turno?.nomeTurno);

      // KPI desligados
      if (c.status === "DESLIGADO") {
        kpis.desligados++;

        // se você quiser MOSTRAR desligado na tabela, descomente o bloco abaixo:
        /*
        linhas.push({
          colaborador: c.nomeCompleto,
          lider: c.lider?.nomeCompleto || "-",
          empresa: c.empresa?.nomeEmpresa || "-",
          setor: c.setor?.nomeSetor || "Sem setor",
          turno: turnoNorm,
          escala: c.escala?.nomeEscala || "-",
          tempoEmpresa: getFaixaTempoEmpresa(c.dataAdmissao, fim),
          entrada: null,
          saida: null,
          horasTrabalhadas: 0,
          horasExtra: 0,
          status: "DESLIGADO",
        });
        */
        return;
      }

      // ativo
      kpis.ativos++;

      const registros = freqMap.get(c.opsId) || [];

      // DSR no dia snapshot => ignora presença do snapshot (igual operacional)
      if (c.escala?.nomeEscala && isDiaDSR(fim, c.escala.nomeEscala)) {
        // ainda pode aparecer na tabela como DSR se você quiser,
        // mas normalmente vocês ignoram.
        return;
      }

      // snapshot do dia final do range
      const registroSnapshot =
        registros.find((r) => toISODateStr(r.dataReferencia) === snapshotStr) || null;

      // dias úteis do período (cache por escala)
      const esc = c.escala?.nomeEscala || "";
      if (!diasUteisCache.has(esc)) {
        diasUteisCache.set(esc, getDiasUteisPeriodo(inicio, fim, esc));
      }
      const diasUteis = diasUteisCache.get(esc);
      const totalDias = diasUteis.length;

      // map rápido data -> registro (para período > 1 dia)
      const freqMapDia = new Map(registros.map((r) => [toISODateStr(r.dataReferencia), r]));

      // ===== KPI PRESENÇA (seu contrato) =====
      if (totalDias <= 1) {
        // diário: snapshot manda
        const { status } = getStatusDoDia(registroSnapshot, c);

        if (status === "PRESENTE") {
          kpis.presentes++;
        } else if (status === "ATRASO") {
          kpis.atrasos++;
          kpis.presentes++; // atraso conta como presença
        } else {
          // "FALTA" ou motivo de ausência
          if (isAusenciaValida(status) || status === "FALTA") kpis.ausentes++;
        }
      } else {
        // período > 1 dia: regra plena
        const diasTrabalhados = diasUteis.filter((dia) => {
          const reg = freqMapDia.get(dia);
          return !!reg?.horaEntrada;
        }).length;

        if (diasTrabalhados === totalDias) {
          kpis.presentes++;
        } else if (diasTrabalhados === 0) {
          kpis.ausentes++;
        }
        // parcial: ignora KPI (igual teu contrato)
      }

      // idade
      if (c.dataNascimento) {
        somaIdade += calcIdade(c.dataNascimento, fim);
        qtdIdade++;
      }

      // tempo empresa
      if (c.dataAdmissao) {
        somaTempoEmpresa += diffDays(c.dataAdmissao, fim);
        qtdTempoEmpresa++;
      }

      // distribuições (baseadas no universo filtrado)
      const setor = c.setor?.nomeSetor || "Sem setor";
      const genero = (c.genero || "N/I").toUpperCase();

      setorGenero[setor] ??= { masculino: 0, feminino: 0, total: 0 };
      if (genero.startsWith("M")) setorGenero[setor].masculino++;
      if (genero.startsWith("F")) setorGenero[setor].feminino++;
      setorGenero[setor].total++;

      porTurno[turnoNorm] = (porTurno[turnoNorm] || 0) + 1;
      porEscala[c.escala?.nomeEscala || "Sem escala"] =
        (porEscala[c.escala?.nomeEscala || "Sem escala"] || 0) + 1;

      // horas trabalhadas (snapshot)
      const entradaMin = timeToMinutes(registroSnapshot?.horaEntrada);
      const saidaMin = timeToMinutes(registroSnapshot?.horaSaida);
      const minutos = entradaMin != null && saidaMin != null ? saidaMin - entradaMin : 0;

      // status para tabela (snapshot)
      const { status: statusTabela } = getStatusDoDia(registroSnapshot, c);

      linhas.push({
        colaborador: c.nomeCompleto,
        lider: c.lider?.nomeCompleto || "-",
        empresa: c.empresa?.nomeEmpresa || "-",
        setor,
        turno: turnoNorm,
        escala: c.escala?.nomeEscala || "-",
        tempoEmpresa: getFaixaTempoEmpresa(c.dataAdmissao, fim),
        entrada: registroSnapshot?.horaEntrada || null,
        saida: registroSnapshot?.horaSaida || null,
        horasTrabalhadas: Number((minutos / 60).toFixed(2)),
        horasExtra: 0,
        status: statusTabela,
      });
    });

    // médias
    kpis.mediaIdade = qtdIdade ? +(somaIdade / qtdIdade).toFixed(1) : 0;
    kpis.tempoMedioEmpresa = qtdTempoEmpresa ? +(somaTempoEmpresa / qtdTempoEmpresa / 365).toFixed(1) : 0;

    /* ===============================
       7) RESPONSE
    =============================== */
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 50;

    return res.json({
      success: true,
      data: {
        dataOperacional: dataOperacionalStr,
        turnoAtual,
        snapshotDate: snapshotStr,
        kpis,
        distribuicoes: {
          setorGenero,
          colaboradorPorTurno: porTurno,
          colaboradorPorEscala: porEscala,
        },
        colaboradores: linhas.slice((p - 1) * ps, p * ps),
        pagination: {
          page: p,
          pageSize: ps,
          total: linhas.length,
        },
      },
    });
  } catch (err) {
    console.error("❌ Erro dashboard colaboradores:", err);
    res.status(500).json({ success: false });
  }
};

module.exports = { carregarDashboardColaboradores };
