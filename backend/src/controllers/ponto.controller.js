// src/controllers/ponto.controller.js
const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  errorResponse,
} = require("../utils/response");
const { getDateOperacional } = require("../utils/dateOperacional");
const { finalizarAtestadosVencidos } = require("../utils/atestadoAutoFinalize");
const { exportarControlePresenca } = require("../services/googleSheetsPresenca.service");
const { error } = require("../utils/logger");

let tipoDSRCache = null;
/* =====================================================
   HELPERS
===================================================== */
function agoraBrasil() {
  const now = new Date();
  const spString = now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(spString);
}

function startOfDay(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStatusAdministrativo(c, dataCalendario) {
  // 🏥 ATESTADO MÉDICO
  const atestado = c.atestadosMedicos?.find(
    (a) =>
      dataCalendario >= startOfDay(a.dataInicio) &&
      dataCalendario <= startOfDay(a.dataFim)
  );
  if (atestado) {
    return { status: "AM", origem: "atestado" };
  }

  // 📄 OUTRAS AUSÊNCIAS
  const ausencia = c.ausencias?.find(
    (a) =>
      dataCalendario >= startOfDay(a.dataInicio) &&
      dataCalendario <= startOfDay(a.dataFim)
  );
  if (ausencia) {
    return {
      status: ausencia.tipoAusencia?.codigo || "AUS",
      origem: "ausencia",
    };
  }

  return null;
}

function getEscalaNoDia(opsId, data, historicoMap) {
  const registros = historicoMap[opsId];
  if (!registros) return null;

  const d = new Date(data);

  const registro = registros.find((r) => {
    const inicio = new Date(r.dataInicio);
    const fim = r.dataFim ? new Date(r.dataFim) : null;

    return d >= inicio && (!fim || d <= fim);
  });

  return registro?.escala?.nomeEscala || null;
}

async function getTipoDSR() {
  if (!tipoDSRCache) {
    tipoDSRCache = await prisma.tipoAusencia.findFirst({
      where: { codigo: "DSR" },
    });
  }
  return tipoDSRCache;
}

// "âncora" pra salvar time-only no Postgres (campo @db.Time)
function toTimeOnly(dateObj) {
  const d = new Date(dateObj);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
}

function ymd(dateObj) {
  return new Date(dateObj).toISOString().slice(0, 10);
}

// Extrai minutos a partir de um DateTime que representa "time"
function timeToMinutes(timeDate) {
  const d = new Date(timeDate);
  return d.getUTCHours() * 60 + d.getUTCMinutes(); // geralmente Time(6) vem em UTC
}

// minutos do "agora" (local)
function nowToMinutes(dateObj) {
  const d = new Date(dateObj);
  return d.getHours() * 60 + d.getMinutes();
}


function isDiaDSR(dataOperacional, nomeEscala) {
  // 0 = domingo ... 6 = sábado
  const dow = new Date(dataOperacional).getDay();

  const dsrMap = {
    E: [0, 1], // domingo, segunda
    G: [2, 3], // terça, quarta
    C: [4, 5], // quinta, sexta
  };

  const dias = dsrMap[String(nomeEscala || "").toUpperCase()];
  return !!dias?.includes(dow);
}



/* =====================================================
   POST /ponto/registrar  (colaborador bate ponto via CPF)
===================================================== */
const registrarPontoCPF = async (req, res) => {
  const reqId = `PONTO-${Date.now()}`;

  try {
    await finalizarAtestadosVencidos();

    const { cpf } = req.body;

    console.log(`[${reqId}] registrarPontoCPF body:`, { cpf });

    if (!cpf) return errorResponse(res, "CPF não informado", 400);

    const agora = agoraBrasil();

    /* ==========================================
       BUSCA COLABORADOR
    ========================================== */

    const colaborador = await prisma.colaborador.findFirst({
      where: { cpf },
      include: {
        turno: true,
        escala: true,
        ausencias: {
          where: {
            status: "ATIVO",
            dataInicio: { lte: startOfDay(agora) },
            dataFim: { gte: startOfDay(agora) },
          },
          include: { tipoAusencia: true },
        },
        atestadosMedicos: {
          where: {
            status: "ATIVO",
            dataInicio: { lte: startOfDay(agora) },
            dataFim: { gte: startOfDay(agora) },
          },
        },
      },
    });

    if (!colaborador)
      return notFoundResponse(res, "Colaborador não encontrado");

    if (colaborador.status !== "ATIVO" || colaborador.dataDesligamento) {
      return errorResponse(res, "Colaborador não está ativo", 403);
    }

    /* ==========================================
       DIA OPERACIONAL
    ========================================== */

    const { dataOperacional, turnoAtual } = getDateOperacional(agora);
    const dataReferenciaOperacional = startOfDay(dataOperacional);

    const frequenciaDia = await prisma.frequencia.findUnique({
      where: {
        opsId_dataReferencia: {
          opsId: colaborador.opsId,
          dataReferencia: dataReferenciaOperacional,
        },
      },
      include: {
        tipoAusencia: true,
      },
    });

    /* ==========================================
       BLOQUEIO S1
    ========================================== */

    if (frequenciaDia?.tipoAusencia?.codigo === "S1") {
      return errorResponse(
        res,
        "Este dia está marcado como Sinergia Enviada (S1).",
        403
      );
    }

    console.log(
      `[${reqId}] opsId=${colaborador.opsId} turnoColab=${colaborador.turno?.nomeTurno} turnoAtual=${turnoAtual}`
    );

    /* ==========================================
       FREQUÊNCIA ABERTA
    ========================================== */

    const aberta = await prisma.frequencia.findFirst({
      where: {
        opsId: colaborador.opsId,
        horaSaida: null,
        dataReferencia: {
          lte: dataReferenciaOperacional,
        },
      },
      orderBy: {
        dataReferencia: "desc",
      },
    });

    /* ==========================================
       BLOQUEIO ANTECIPAÇÃO T3
    ========================================== */

    if (
      !aberta &&
      colaborador.turno?.nomeTurno === "T3" &&
      turnoAtual !== "T3"
    ) {
      return errorResponse(
        res,
        "Ponto liberado para o T3 somente a partir das 20:50",
        400
      );
    }

    /* ==========================================
       ESCALA DO DIA (HISTÓRICO)
    ========================================== */

    const escalaDia = await prisma.colaboradorEscalaHistorico.findFirst({
      where: {
        opsId: colaborador.opsId,
        dataInicio: { lte: dataReferenciaOperacional },
        OR: [
          { dataFim: null },
          { dataFim: { gte: dataReferenciaOperacional } },
        ],
      },
      include: { escala: true },
      orderBy: {
        dataInicio: "desc",
      },
    });

    /* ==========================================
       BLOQUEIOS ADMINISTRATIVOS (ENTRADA)
    ========================================== */

    if (!aberta) {

      if (isDiaDSR(dataReferenciaOperacional, escalaDia?.escala?.nomeEscala)) {
        return errorResponse(
          res,
          "Hoje é DSR do colaborador",
          400
        );
      }

      if (colaborador.ausencias?.length > 0) {
        const cod = colaborador.ausencias[0]?.tipoAusencia?.codigo || "AUS";
        return errorResponse(
          res,
          `Colaborador possui ausência ativa (${cod})`,
          400
        );
      }

      if (colaborador.atestadosMedicos?.length > 0) {
        return errorResponse(
          res,
          "Colaborador possui atestado médico ativo",
          400
        );
      }

    }

    /* ==========================================
       FECHAR FREQUÊNCIA ABERTA (SAÍDA)
    ========================================== */

    const horaAgora = toTimeOnly(agora);

    if (aberta?.horaEntrada && !aberta?.horaSaida) {

      const entradaMin = timeToMinutes(aberta.horaEntrada);
      const agoraMin = nowToMinutes(agora);

      let minutosDecorridos = agoraMin - entradaMin;

      if (minutosDecorridos < 0) minutosDecorridos += 24 * 60;

      if (minutosDecorridos < 60) {

        const faltam = 60 - minutosDecorridos;

        return errorResponse(
          res,
          `Saída permitida somente após 1h da entrada. Aguarde mais ${faltam} min.`,
          409
        );

      }

      if (minutosDecorridos > 24 * 60) {

        return errorResponse(
          res,
          "Frequência anterior aberta há mais de 24h. Procure o RH.",
          409
        );

      }

      const horasTrabalhadas = Number(
        (minutosDecorridos / 60).toFixed(2)
      );

      const atualizado = await prisma.frequencia.update({
        where: { idFrequencia: aberta.idFrequencia },
        data: {
          horaSaida: horaAgora,
          horasTrabalhadas,
        },
      });

      return successResponse(
        res,
        atualizado,
        "Saída registrada com sucesso"
      );
    }

    /* ==========================================
       VERIFICA JORNADA DUPLICADA
    ========================================== */

    if (frequenciaDia?.horaEntrada && frequenciaDia?.horaSaida) {
      return errorResponse(
        res,
        "Já existe uma jornada finalizada para este dia operacional",
        409
      );
    }

    /* ==========================================
       CORRIGE REGISTRO INCONSISTENTE
    ========================================== */

    if (frequenciaDia && !frequenciaDia.horaEntrada) {

      const atualizado = await prisma.frequencia.update({
        where: { idFrequencia: frequenciaDia.idFrequencia },
        data: { horaEntrada: horaAgora },
      });

      return createdResponse(
        res,
        atualizado,
        "Entrada registrada com sucesso"
      );

    }

    /* ==========================================
       CRIA ENTRADA
    ========================================== */

    const tipoPresenca = await prisma.tipoAusencia.findFirst({
      where: { codigo: "P" },
    });

    const registro = await prisma.frequencia.create({
      data: {
        opsId: colaborador.opsId,
        dataReferencia: dataReferenciaOperacional,
        horaEntrada: horaAgora,
        idTipoAusencia: tipoPresenca?.idTipoAusencia ?? null,
        registradoPor: colaborador.opsId,
        validado: false,
      },
    });

    return createdResponse(
      res,
      registro,
      "Entrada registrada com sucesso"
    );

  } catch (err) {

    console.error(`[${reqId}] ❌ ERRO registrarPontoCPF:`, err);

    if (err?.code === "P2002") {

      return errorResponse(
        res,
        "Já existe registro de ponto para este dia operacional",
        409
      );

    }

    return errorResponse(
      res,
      "Erro ao registrar ponto",
      500,
      err?.message || err
    );
  }
};


/* =====================================================
   GET /ponto/controle?mes=YYYY-MM&turno=T1&escala=A
   (grade mensal)
===================================================== */
const getControlePresenca = async (req, res) => {
  const reqId = `CTRL-${Date.now()}`;

  try {
    await finalizarAtestadosVencidos();

    const {
      mes,
      turno,
      escala,
      search,
      lider,
      pendenciaSaida,
      pendentesHoje,
    } = req.query;

    console.log(`[${reqId}] /ponto/controle query:`, req.query);

    if (!mes) {
      return errorResponse(res, "Parâmetro 'mes' é obrigatório (YYYY-MM)", 400);
    }

    const [ano, mesNum] = mes.split("-").map(Number);

    if (!ano || !mesNum) {
      return errorResponse(res, "Parâmetro 'mes' inválido (use YYYY-MM)", 400);
    }

    const inicioMes = new Date(ano, mesNum - 1, 1);
    inicioMes.setHours(0, 0, 0, 0);

    const fimMes = new Date(ano, mesNum, 0);
    fimMes.setHours(23, 59, 59, 999);

    /* =====================================================
       FILTROS COLABORADOR
    ===================================================== */
    const whereColaborador = {
      status: "ATIVO",
      dataDesligamento: null,
      NOT: {
        cargo: {
          nomeCargo: {
            in: [
              "Líder de logística",
              "Analista De Logística JR",
              "Assistente COP",
              "Supervisor Operações",
              "Supervisor COP",
            ],
            mode: "insensitive",
          },
        },
      },
      ...(turno && turno !== "TODOS"
        ? { turno: { nomeTurno: turno } }
        : {}),
      ...(escala && escala !== "TODOS"
        ? { escala: { nomeEscala: escala } }
        : {}),
      ...(lider && lider !== "TODOS"
        ? { idLider: lider }
        : {}),
      ...(search
        ? { nomeCompleto: { contains: String(search), mode: "insensitive" } }
        : {}),
      ...(pendenciaSaida === "true"
        ? {
            frequencias: {
              some: {
                dataReferencia: { gte: inicioMes, lte: fimMes },
                horaEntrada: { not: null },
                horaSaida: null,
              },
            },
          }
        : {}),
    };

    const colaboradores = await prisma.colaborador.findMany({
      where: whereColaborador,
      include: {
        turno: true,
        escala: true,
        ausencias: {
          where: {
            status: "ATIVO",
            dataInicio: { lte: fimMes },
            dataFim: { gte: inicioMes },
          },
          include: { tipoAusencia: true },
        },
        atestadosMedicos: {
          where: {
            status: "ATIVO",
            dataInicio: { lte: fimMes },
            dataFim: { gte: inicioMes },
          },
        },
      },
      orderBy: { nomeCompleto: "asc" },
    });

    console.log(`[${reqId}] colaboradores encontrados:`, colaboradores.length);

    if (!colaboradores.length) {
      return successResponse(res, { dias: [], colaboradores: [] });
    }

    /* =====================================================
       OPS IDS
    ===================================================== */
    const opsIds = colaboradores.map((c) => c.opsId);

    /* =====================================================
       HISTÓRICO DE ESCALA
    ===================================================== */
    const historicoEscalas = await prisma.colaboradorEscalaHistorico.findMany({
      where: {
        opsId: { in: opsIds },
      },
      include: {
        escala: true,
      },
      orderBy: [
        { opsId: "asc" },
        { dataInicio: "asc" },
      ],
    });

    const historicoMap = {};

    for (const h of historicoEscalas) {
      if (!historicoMap[h.opsId]) historicoMap[h.opsId] = [];
      historicoMap[h.opsId].push(h);
    }

    /* =====================================================
       FREQUÊNCIAS
    ===================================================== */
    const frequencias = await prisma.frequencia.findMany({
      where: {
        opsId: { in: opsIds },
        dataReferencia: { gte: inicioMes, lte: fimMes },
      },
      include: { tipoAusencia: true },
      orderBy: [
        { dataReferencia: "asc" },
        { manual: "asc" },
        { idFrequencia: "asc" },
      ],
    });

    console.log(`[${reqId}] frequencias do mês:`, frequencias.length);

    const freqMap = {};

    for (const f of frequencias) {
      const key = `${f.opsId}_${ymd(f.dataReferencia)}`;

      if (!freqMap[key]) {
        freqMap[key] = f;
        continue;
      }

      if (f.manual && !freqMap[key].manual) {
        freqMap[key] = f;
        continue;
      }

      if (f.manual && freqMap[key].manual) {
        if (f.idFrequencia > freqMap[key].idFrequencia) {
          freqMap[key] = f;
        }
      }
    }

    /* =====================================================
       DIAS DO MÊS
    ===================================================== */
    const dias = Array.from(
      { length: new Date(ano, mesNum, 0).getDate() },
      (_, i) => i + 1
    );

    /* =====================================================
       MONTAGEM DA GRADE
    ===================================================== */
    const resultado = [];

    for (const c of colaboradores) {
      const diasMap = {};

      for (let d = 1; d <= dias.length; d++) {
        const dataCalendario = new Date(ano, mesNum - 1, d);
        dataCalendario.setHours(0, 0, 0, 0);

        const dataISO = ymd(dataCalendario);
        const key = `${c.opsId}_${dataISO}`;

        /* ===============================
           MANUAL TEM PRIORIDADE
        =============================== */
        if (freqMap[key]?.manual) {
          const f = freqMap[key];

          diasMap[dataISO] = {
            status: f.tipoAusencia?.codigo || "-",
            entrada: f.horaEntrada,
            saida: f.horaSaida,
            validado: !!f.validado,
            manual: true,
          };
          continue;
        }

        /* ===============================
           STATUS ADMINISTRATIVO
        =============================== */
        const statusAdmin = getStatusAdministrativo(c, dataCalendario);

        if (statusAdmin) {
          diasMap[dataISO] = {
            status: statusAdmin.status,
            origem: statusAdmin.origem,
            manual: false,
          };
          continue;
        }

        /* ===============================
           FREQUÊNCIA
        =============================== */
        if (freqMap[key]) {
          const f = freqMap[key];

          diasMap[dataISO] = {
            status: f.tipoAusencia?.codigo || "-",
            entrada: f.horaEntrada,
            saida: f.horaSaida,
            validado: !!f.validado,
            manual: !!f.manual,
          };
          continue;
        }

        /* ===============================
           DSR BASEADO NA ESCALA DO DIA
           OBS: APENAS EXIBE, NÃO ESCREVE NO BANCO
        =============================== */
        const escalaDia = getEscalaNoDia(c.opsId, dataCalendario, historicoMap);

        if (isDiaDSR(dataCalendario, escalaDia)) {
          diasMap[dataISO] = {
            status: "DSR",
            manual: false,
          };
          continue;
        }

        /* ===============================
           FALTA / SEM LANÇAMENTO
        =============================== */
        diasMap[dataISO] = {
          status: "-",
          manual: false,
        };
      }

      resultado.push({
        opsId: c.opsId,
        nome: c.nomeCompleto,
        turno: c.turno?.nomeTurno || null,
        escala: c.escala?.nomeEscala || null,
        dias: diasMap,
      });
    }

    /* =====================================================
       FILTRO PENDENTES HOJE
    ===================================================== */
    let colaboradoresFiltrados = resultado;

    if (pendentesHoje === "true") {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const diaHoje = hoje.getDate();
      const mesHoje = hoje.getMonth() + 1;
      const anoHoje = hoje.getFullYear();

      if (ano === anoHoje && mesNum === mesHoje) {
        const dataHojeISO = ymd(hoje);

        colaboradoresFiltrados = resultado.filter((c) => {
          const registroHoje = c.dias[dataHojeISO];
          return !registroHoje || registroHoje.status === "-";
        });
      }
    }

    return successResponse(res, {
      dias,
      colaboradores: colaboradoresFiltrados,
    });

  } catch (err) {
    console.error(`[${reqId}] ❌ ERRO /ponto/controle:`, err);

    return errorResponse(
      res,
      "Erro ao buscar controle de presença",
      500,
      err?.message || err
    );
  }
};

const ajusteManualPresenca = async (req, res) => {
  try {
    const {
      opsId,
      dataReferencia,
      status,
      justificativa,
      horaEntrada,
      horaSaida,
    } = req.body;

    /* ===============================
       VALIDAÇÕES BÁSICAS
    =============================== */
    if (!opsId || !dataReferencia || !status || !justificativa) {
      return errorResponse(
        res,
        "Campos obrigatórios: opsId, dataReferencia, status, justificativa",
        400
      );
    }

    const JUSTIFICATIVAS_PERMITIDAS = [
      "ESQUECIMENTO_MARCACAO",
      "ALTERACAO_PONTO",
      "MARCACAO_INDEVIDA",
      "ATESTADO_MEDICO",
      "SINERGIA_ENVIADA",
      "HORA_EXTRA",
      "LICENCA",
      "ON", // ✅ ONBOARDING
    ];

    const justificativaNormalizada = String(justificativa)
      .trim()
      .toUpperCase();

    if (!JUSTIFICATIVAS_PERMITIDAS.includes(justificativaNormalizada)) {
      return errorResponse(res, "Justificativa inválida", 400);
    }

    /* ===============================
       COLABORADOR
    =============================== */
    const colaborador = await prisma.colaborador.findUnique({
      where: { opsId },
    });

    if (!colaborador)
      return notFoundResponse(res, "Colaborador não encontrado");



    if (colaborador.dataDesligamento || colaborador.status !== "ATIVO") {
      return errorResponse(
        res,
        "Colaborador não está ativo",
        403
      );
    }

    /* ===============================
       DATA BASE (DIA CIVIL)
    =============================== */
    const [y, m, d] = dataReferencia.split("-").map(Number);
    const dataRef = new Date(y, m - 1, d);
    dataRef.setHours(0, 0, 0, 0);

    /* ===============================
       TIPO DE STATUS
    =============================== */
    const tipo = await prisma.tipoAusencia.findUnique({
      where: { codigo: status },
    });

    if (!tipo) {
      return errorResponse(res, `Status inválido: ${status}`, 400);
    }

    if (status === "S1") {
    const registro = await prisma.frequencia.upsert({
      where: {
        opsId_dataReferencia: {
          opsId,
          dataReferencia: dataRef,
        },
      },
      update: {
        idTipoAusencia: tipo.idTipoAusencia,
        horaEntrada: null,
        horaSaida: null,
        horasTrabalhadas: null,
        justificativa: "SINERGIA_ENVIADA",
        manual: true,
        validado: true,
        registradoPor: req.user?.id || "GESTAO",
      },
      create: {
        opsId,
        dataReferencia: dataRef,
        idTipoAusencia: tipo.idTipoAusencia,
        horaEntrada: null,
        horaSaida: null,
        horasTrabalhadas: null,
        justificativa: "SINERGIA_ENVIADA",
        manual: true,
        validado: true,
        registradoPor: req.user?.id || "GESTAO",
      },
    });

    return successResponse(
      res,
      registro,
      "Sinergia Enviada aplicada com sucesso"
    );
  }
    /* =====================================================
       🟢 REGRA ESPECÍFICA: ONBOARDING (ON)
       - ignora horários
       - ignora jornada
       - sempre manual e validado
    ===================================================== */
    if (status === "ON") {
      const registro = await prisma.frequencia.upsert({
        where: {
          opsId_dataReferencia: {
            opsId,
            dataReferencia: dataRef,
          },
        },
        update: {
          idTipoAusencia: tipo.idTipoAusencia,
          horaEntrada: null,
          horaSaida: null,
          justificativa: "ON",
          manual: true,
          validado: true,
          registradoPor: req.user?.id || "GESTAO",
        },
        create: {
          opsId,
          dataReferencia: dataRef,
          idTipoAusencia: tipo.idTipoAusencia,
          horaEntrada: null,
          horaSaida: null,
          justificativa: "ON",
          manual: true,
          validado: true,
          registradoPor: req.user?.id || "GESTAO",
        },
      });

      return successResponse(
        res,
        registro,
        "Onboarding registrado com sucesso"
      );
    }

    /* ===============================
       VALIDAÇÕES DE JORNADA (NÃO ON)
    =============================== */
    if (horaSaida && !horaEntrada) {
      return errorResponse(
        res,
        "Hora de saída não pode existir sem hora de entrada",
        400
      );
    }

    if (status === "P" && !horaEntrada) {
      return errorResponse(
        res,
        "Horário de entrada é obrigatório para status 'Presente'",
        400
      );
    }

    if (horaEntrada && horaSaida) {
      const [hE, mE] = horaEntrada.split(":").map(Number);
      const [hS, mS] = horaSaida.split(":").map(Number);

      let minutosTrabalhados = hS * 60 + mS - (hE * 60 + mE);

      // 🔑 virada de dia (T3)
      if (minutosTrabalhados < 0) {
        minutosTrabalhados += 24 * 60;
      }

      if (minutosTrabalhados <= 0 || minutosTrabalhados > 16 * 60) {
        return errorResponse(
          res,
          "Jornada inválida. Verifique os horários informados.",
          400
        );
      }
    }

    /* ===============================
       CONVERSÃO DE HORAS
    =============================== */
    const toTime = (t) =>
      t ? new Date(`1970-01-01T${t}:00.000Z`) : null;

    let horaSaidaFinal = null;

    if (horaSaida) {
      const [hE, mE] = horaEntrada.split(":").map(Number);
      const [hS, mS] = horaSaida.split(":").map(Number);

      const virouDia = hS * 60 + mS < hE * 60 + mE;

      const base = new Date(dataRef);
      if (virouDia) base.setDate(base.getDate() + 1);

      horaSaidaFinal = new Date(
        `${base.toISOString().slice(0, 10)}T${horaSaida}:00`
      );
    }

    /* ===============================
       UPSERT FINAL
    =============================== */
    const registro = await prisma.frequencia.upsert({
      where: {
        opsId_dataReferencia: {
          opsId,
          dataReferencia: dataRef,
        },
      },
      update: {
        idTipoAusencia: tipo.idTipoAusencia,
        horaEntrada: toTime(horaEntrada),
        horaSaida: horaSaidaFinal,
        justificativa: justificativaNormalizada,
        manual: true,
        validado: true,
        registradoPor: req.user?.id || "GESTAO",
      },
      create: {
        opsId,
        dataReferencia: dataRef,
        idTipoAusencia: tipo.idTipoAusencia,
        horaEntrada: toTime(horaEntrada),
        horaSaida: horaSaidaFinal,
        justificativa: justificativaNormalizada,
        manual: true,
        validado: true,
        registradoPor: req.user?.id || "GESTAO",
      },
    });

    return successResponse(
      res,
      registro,
      "Ajuste manual realizado com sucesso"
    );
  } catch (err) {
    console.error("❌ ERRO ajuste manual:", err);
    return errorResponse(res, "Erro ao realizar ajuste manual", 500);
  }
};




/* =====================================================
   GET /ponto/exportar-sheets
   (exportação manual para Google Sheets)
===================================================== */
const exportarPresencaSheets = async (req, res) => {
  const reqId = `EXPORT-${Date.now()}`;

  try {
    const { mes } = req.query;

    console.log(`[${reqId}] /ponto/exportar-sheets query:`, req.query);

    if (!mes) {
      return errorResponse(res, "Parâmetro 'mes' é obrigatório (YYYY-MM)", 400);
    }

    const [ano, mesNum] = mes.split("-").map(Number);
    if (!ano || !mesNum) {
      return errorResponse(res, "Parâmetro 'mes' inválido (use YYYY-MM)", 400);
    }

    const inicioMes = new Date(ano, mesNum - 1, 1);
    const fimMes = new Date(ano, mesNum, 0, 23, 59, 59);

    // Exporta sempre completo, sem filtros de turno/escala/lider
    const whereColaborador = {
      status: "ATIVO",
      dataDesligamento: null,
      NOT: {
        cargo: {
          nomeCargo: {
            in: [
              "Líder de logística",
              "Analista De Logística JR",
              "Assistente COP",
              "Supervisor Operações",
              "Supervisor COP",
            ],
            mode: "insensitive",
          },
        },
      },
    };

    const colaboradores = await prisma.colaborador.findMany({
      where: whereColaborador,
      include: {
        turno: true,
        escala: true,
        ausencias: {
          where: {
            status: "ATIVO",
            dataInicio: { lte: fimMes },
            dataFim: { gte: inicioMes },
          },
          include: { tipoAusencia: true },
        },
        atestadosMedicos: {
          where: {
            status: "ATIVO",
            dataInicio: { lte: fimMes },
            dataFim: { gte: inicioMes },
          },
        },
      },
      orderBy: { nomeCompleto: "asc" },
    });

    if (!colaboradores.length) {
      return errorResponse(res, "Nenhum colaborador encontrado para os filtros selecionados", 404);
    }

    const opsIds = colaboradores.map((c) => c.opsId);

    /* =====================================================
      HISTÓRICO DE ESCALA
    ===================================================== */

    const historicoEscalas = await prisma.colaboradorEscalaHistorico.findMany({
      where: {
        opsId: { in: opsIds },
      },
      include: {
        escala: true,
      },
    });

    const historicoMap = {};

    for (const h of historicoEscalas) {
      if (!historicoMap[h.opsId]) historicoMap[h.opsId] = [];
      historicoMap[h.opsId].push(h);
    }
    

    const frequencias = await prisma.frequencia.findMany({
      where: {
        opsId: { in: opsIds },
        dataReferencia: { gte: inicioMes, lte: fimMes },
      },
      include: { tipoAusencia: true },
      orderBy: [
        { dataReferencia: "asc" },
        { manual: "asc" },
        { idFrequencia: "asc" },
      ],
    });

    // Processar dados (mesma lógica do getControlePresenca)
    const freqMap = {};
    for (const f of frequencias) {
      const key = `${f.opsId}_${ymd(f.dataReferencia)}`;

      if (!freqMap[key]) {
        freqMap[key] = f;
        continue;
      }

      if (f.manual && !freqMap[key].manual) {
        freqMap[key] = f;
        continue;
      }

      if (f.manual && freqMap[key].manual) {
        if (f.idFrequencia > freqMap[key].idFrequencia) freqMap[key] = f;
      }
    }

    const dias = Array.from(
      { length: new Date(ano, mesNum, 0).getDate() },
      (_, i) => i + 1
    );

    const resultado = colaboradores.map((c) => {
      const diasMap = {};

      for (let d = 1; d <= dias.length; d++) {
        const dataCalendario = new Date(ano, mesNum - 1, d);
        dataCalendario.setHours(0, 0, 0, 0);
        const dataISO = ymd(dataCalendario);
        const key = `${c.opsId}_${dataISO}`;

        // Manual tem prioridade
        if (freqMap[key]?.manual) {
          const f = freqMap[key];
          diasMap[dataISO] = {
            status: f.tipoAusencia?.codigo || "P",
            entrada: f.horaEntrada,
            saida: f.horaSaida,
            validado: !!f.validado,
            manual: true,
          };
          continue;
        }

        // Status administrativo
        const statusAdmin = getStatusAdministrativo(c, dataCalendario);
        if (statusAdmin) {
          diasMap[dataISO] = {
            status: statusAdmin.status,
            origem: statusAdmin.origem,
            manual: false,
          };
          continue;
        }

        // Frequência
        if (freqMap[key]) {
          const f = freqMap[key];
          diasMap[dataISO] = {
            status: f.tipoAusencia?.codigo || "P",
            entrada: f.horaEntrada,
            saida: f.horaSaida,
            validado: f.validado,
            manual: f.manual ?? false,
          };
          continue;
        }

        // DSR
        const escalaDia = getEscalaNoDia(c.opsId, dataCalendario, historicoMap);
        if (isDiaDSR(dataCalendario, escalaDia)) {
          diasMap[dataISO] = {
            status: "DSR",
            manual: false,
          };
          continue;
        }

        // Falta
        diasMap[dataISO] = {
          status: "-",
          manual: false,
        };
      }

      return {
        opsId: c.opsId,
        nome: c.nomeCompleto,
        turno: c.turno?.nomeTurno,
        escala: c.escala?.nomeEscala,
        dias: diasMap,
      };
    });

    // 🔍 LOG DE DEBUG: Mostrar amostra dos dados antes de exportar
    console.log(`[${reqId}] 📊 Amostra de dados processados (primeiro colaborador):`);
    if (resultado.length > 0) {
      const amostra = resultado[0];
      console.log(`   - OPS ID: ${amostra.opsId}`);
      console.log(`   - Nome: ${amostra.nome}`);
      console.log(`   - Turno: ${amostra.turno}`);
      console.log(`   - Escala: ${amostra.escala}`);
      console.log(`   - Dias processados: ${Object.keys(amostra.dias).length}`);
      
      // Mostrar primeiros 3 dias como exemplo
      const diasExemplo = Object.entries(amostra.dias).slice(0, 3);
      console.log(`   - Exemplo dos primeiros dias:`);
      diasExemplo.forEach(([data, registro]) => {
        console.log(`     ${data}: status=${registro.status}, entrada=${registro.entrada || 'N/A'}, saida=${registro.saida || 'N/A'}`);
      });
    }

    // Exportar para Google Sheets
    const resultadoExportacao = await exportarControlePresenca(mes, {
      dias,
      colaboradores: resultado,
    });

    console.log(`[${reqId}] ✅ Exportação concluída`);

    return successResponse(res, resultadoExportacao.data, "Exportação realizada com sucesso");
  } catch (err) {
    console.error(`[${reqId}] ❌ ERRO /ponto/exportar-sheets:`, err);
    return errorResponse(
      res,
      "Erro ao exportar para Google Sheets",
      500,
      err?.message || err
    );
  }
};

module.exports = {
  registrarPontoCPF,
  getControlePresenca,
  ajusteManualPresenca,
  exportarPresencaSheets,
};
