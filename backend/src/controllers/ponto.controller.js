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
    A: [0, 3], // domingo, quarta
    B: [1, 2], // segunda, terça
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

    if (!colaborador) return notFoundResponse(res, "Colaborador não encontrado");

    if (colaborador.status !== "ATIVO" || colaborador.dataDesligamento) {
      return errorResponse(res, "Colaborador não está ativo", 400);
    }

    /* ==========================================
       DIA OPERACIONAL (SEU getDateOperacional)
       -> serve para ENTRADA (quando não existe aberta)
    ========================================== */
    const { dataOperacional, turnoAtual } = getDateOperacional(agora);
    const dataReferenciaOperacional = startOfDay(dataOperacional);

    console.log(
      `[${reqId}] opsId=${colaborador.opsId} turnoColab=${colaborador.turno?.nomeTurno} turnoAtual=${turnoAtual}`
    );
    console.log(
      `[${reqId}] agora=${agora.toISOString()} dataRefOperacional=${ymd(dataReferenciaOperacional)}`
    );
    /* ==========================================
      BLOQUEIO DE ANTECIPAÇÃO – TURNO T3
      (evita bater ponto antes das 20:50)
    ========================================== */
    if (
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
       BLOQUEIOS (DSR / AUSÊNCIA / ATESTADO)
       -> bloqueia entrada/saída normal
    ========================================== */
    if (isDiaDSR(dataReferenciaOperacional, colaborador.escala?.nomeEscala)) {
      return errorResponse(
        res,
        "Hoje é DSR. Se for hora extra, solicite ajuste manual.",
        400
      );
    }

    if (colaborador.ausencias?.length > 0) {
      const cod = colaborador.ausencias[0]?.tipoAusencia?.codigo || "AUS";
      return errorResponse(res, `Colaborador possui ausência ativa (${cod})`, 400);
    }

    if (colaborador.atestadosMedicos?.length > 0) {
      return errorResponse(res, "Colaborador possui atestado médico ativo", 400);
    }

    /* ==========================================
       1) SEMPRE PRIORIZE FECHAR FREQUÊNCIA ABERTA
       (isso resolve T3 saindo após 05:25)
    ========================================== */
    const aberta = await prisma.frequencia.findFirst({
      where: {
        opsId: colaborador.opsId,
        horaSaida: null,
      },
      orderBy: {
        dataReferencia: "desc",
      },
    });

    const horaAgora = toTimeOnly(agora);

    if (aberta?.horaEntrada && !aberta?.horaSaida) {
      const entradaMin = timeToMinutes(aberta.horaEntrada);
      const agoraMin = nowToMinutes(agora);

      let minutosDecorridos = agoraMin - entradaMin;

      // 🔑 virada de dia (T3 / saída depois da meia-noite)
      if (minutosDecorridos < 0) minutosDecorridos += 24 * 60;

      // 🔒 mínimo 60 min
      if (minutosDecorridos < 60) {
        const faltam = 60 - minutosDecorridos;
        return errorResponse(
          res,
          `Saída permitida somente após 1h da entrada. Aguarde mais ${faltam} min.`,
          409
        );
      }

      // 🔒 segurança (evita frequencia travada dias)
      if (minutosDecorridos > 24 * 60) {
        return errorResponse(
          res,
          `Frequência anterior está aberta há mais de 24h. Entre em contato com o RH para ajuste manual.`,
          409
        );
      }

      const horasTrabalhadas = Number((minutosDecorridos / 60).toFixed(2));

      // ✅ horaSaida é TIME(6) -> use time-only
      const atualizado = await prisma.frequencia.update({
        where: { idFrequencia: aberta.idFrequencia },
        data: {
          horaSaida: horaAgora,
          horasTrabalhadas,
        },
      });

      console.log(
        `[${reqId}] SAÍDA registrada (fecha aberta) dataRef=${ymd(aberta.dataReferencia)} freq=${atualizado.idFrequencia}`
      );

      return successResponse(res, atualizado, "Saída registrada com sucesso");
    }

    /* ==========================================
       2) NÃO HÁ ABERTA -> TRABALHA COM O DIA OPERACIONAL
          - Se já existe jornada finalizada no dia -> 409
          - Se não existe -> cria ENTRADA
    ========================================== */
    const frequenciaDia = await prisma.frequencia.findUnique({
      where: {
        opsId_dataReferencia: {
          opsId: colaborador.opsId,
          dataReferencia: dataReferenciaOperacional,
        },
      },
    });

    // 3ª batida real: já tem entrada e saída no dia operacional
    if (frequenciaDia?.horaEntrada && frequenciaDia?.horaSaida) {
      return errorResponse(
        res,
        "Já existe uma jornada finalizada para este dia operacional",
        409
      );
    }

    // Caso raro: existe registro no dia mas sem entrada (inconsistência)
    if (frequenciaDia && !frequenciaDia.horaEntrada) {
      const atualizado = await prisma.frequencia.update({
        where: { idFrequencia: frequenciaDia.idFrequencia },
        data: { horaEntrada: horaAgora },
      });

      console.log(
        `[${reqId}] ENTRADA preenchida (registro existente) dia=${ymd(dataReferenciaOperacional)} freq=${atualizado.idFrequencia}`
      );

      return createdResponse(res, atualizado, "Entrada registrada com sucesso");
    }

    // ENTRADA normal
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

    console.log(
      `[${reqId}] ENTRADA registrada dia=${ymd(dataReferenciaOperacional)} freq=${registro.idFrequencia}`
    );

    return createdResponse(res, registro, "Entrada registrada com sucesso");
  } catch (err) {
    console.error(`[${reqId}] ❌ ERRO registrarPontoCPF:`, err);

    // Se estourar unique (opsId,dataReferencia) por corrida/duplo clique
    if (err?.code === "P2002") {
      return errorResponse(
        res,
        "Já existe registro de ponto para este dia operacional. Tente novamente.",
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
    
    const { mes, turno, escala, search, lider } = req.query;

    console.log(`[${reqId}] /ponto/controle query:`, req.query);

    if (!mes) {
      return errorResponse(res, "Parâmetro 'mes' é obrigatório (YYYY-MM)", 400);
    }

    const [ano, mesNum] = mes.split("-").map(Number);
    if (!ano || !mesNum) {
      return errorResponse(res, "Parâmetro 'mes' inválido (use YYYY-MM)", 400);
    }

    const inicioMes = new Date(ano, mesNum - 1, 1);
    const fimMes = new Date(ano, mesNum, 0, 23, 59, 59);

    // filtros (no front você manda "TODOS", então aqui trate bem)
    const whereColaborador = {
      status: "ATIVO",
      dataDesligamento: null,
      ...(turno && turno !== "TODOS" ? { turno: { nomeTurno: turno } } : {}),
      ...(escala && escala !== "TODOS" ? { escala: { nomeEscala: escala } } : {}),
      ...(lider && lider !== "TODOS" ? { idlider: lider } : {}),
      ...(search
        ? { nomeCompleto: { contains: String(search), mode: "insensitive" } }
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
            dataInicio: {lte: fimMes},
            dataFim: {gte: inicioMes},
          },
          include: { tipoAusencia: true},
        },
        atestadosMedicos: {
          where: {
            status: "ATIVO",
            dataInicio: {lte: fimMes},
            dataFim: { gte: inicioMes},
          },
        },
      },
      orderBy: { nomeCompleto: "asc" },
    });

    console.log(`[${reqId}] colaboradores encontrados:`, colaboradores.length);

    if (!colaboradores.length) {
      return successResponse(res, { dias: [], colaboradores: [] });
    }

    const opsIds = colaboradores.map((c) => c.opsId);

    const frequencias = await prisma.frequencia.findMany({
      where: {
        opsId: { in: opsIds },
        dataReferencia: { gte: inicioMes, lte: fimMes },
      },
      include: { tipoAusencia: true },
    });

    console.log(`[${reqId}] frequencias do mês:`, frequencias.length);

    const freqMap = {};
    for (const f of frequencias) {
      const key = `${f.opsId}_${ymd(f.dataReferencia)}`;
      freqMap[key] = f;
    }

    const dias = Array.from(
      { length: new Date(ano, mesNum, 0).getDate() },
      (_, i) => i + 1
    );

    const resultado = colaboradores.map((c) => {
      const diasMap = {};

    for (let d = 1; d <= dias.length; d++) {
      // 🔑 dia civil do calendário (SEM virada de turno)
      const dataCalendario = new Date(ano, mesNum - 1, d);
      dataCalendario.setHours(0, 0, 0, 0);

      const dataISO = ymd(dataCalendario);
      const key = `${c.opsId}_${dataISO}`;

      // 1️⃣ Status administrativo tem prioridade
      const statusAdmin = getStatusAdministrativo(c, dataCalendario);
      if (statusAdmin) {
        diasMap[dataISO] = {
          status: statusAdmin.status,
          origem: statusAdmin.origem,
          manual: true,
        };
        continue;
      }

      // 2️⃣ Frequência
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

      // 3️⃣ DSR
      if (isDiaDSR(dataCalendario, c.escala?.nomeEscala)) {
        diasMap[dataISO] = {
          status: "DSR",
          manual: false,
        };
        continue;
      }

      // 4️⃣ FALTA
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

    return successResponse(res, { dias, colaboradores: resultado });
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
      "Hora Extra",
      "LICENCA",
    ];

    if (!JUSTIFICATIVAS_PERMITIDAS.includes(justificativa)) {
      return errorResponse(res, "Justificativa inválida", 400);
    }

    // 🔒 Colaborador válido
    const colaborador = await prisma.colaborador.findFirst({
      where: {
        opsId,
        status: "ATIVO",
        dataDesligamento: null,
      },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado ou inativo");
    }

    // 🔒 Regra de jornada
    if (horaSaida && !horaEntrada) {
      return errorResponse(
        res,
        "Hora de saída não pode existir sem hora de entrada",
        400
      );
    }

    if (horaEntrada && horaSaida) {
      const [hE, mE] = horaEntrada.split(":").map(Number);
      const [hS, mS] = horaSaida.split(":").map(Number);

      let minutosTrabalhados = hS * 60 + mS - (hE * 60 + mE);

      // 🔑 VIRADA DE DIA (T3)
      if (minutosTrabalhados < 0) {
        minutosTrabalhados += 24 * 60;
      }

      // 🔒 REGRA DE SEGURANÇA
      if (minutosTrabalhados <= 0 || minutosTrabalhados > 16 * 60) {
        return errorResponse(
          res,
          "Jornada inválida. Verifique os horários informados.",
          400
        );
      }
    }

    // ✅ Data base (sempre a data da ENTRADA)
    const [y, m, d] = dataReferencia.split("-").map(Number);
    const dataRef = new Date(y, m - 1, d);
    dataRef.setHours(0, 0, 0, 0);

    // 🔍 Tipo de ausência
    const tipo = await prisma.tipoAusencia.findUnique({
      where: { codigo: status },
    });

    if (!tipo) {
      return errorResponse(res, `Status inválido: ${status}`, 400);
    }

    // ⏰ Hora ENTRADA continua time-only
    const toTime = (t) =>
      t ? new Date(`1970-01-01T${t}:00.000Z`) : null;

    // 🔑 AJUSTE DA HORA DE SAÍDA (RESOLVE T3)
    let horaSaidaFinal = null;

    if (horaSaida) {
      const [hE, mE] = horaEntrada.split(":").map(Number);
      const [hS, mS] = horaSaida.split(":").map(Number);

      const virouDia = hS * 60 + mS < hE * 60 + mE;

      const base = new Date(dataRef);
      if (virouDia) {
        base.setDate(base.getDate() + 1);
      }

      horaSaidaFinal = new Date(
        `${base.toISOString().slice(0, 10)}T${horaSaida}:00`
      );
    }

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
        horaSaida: horaSaidaFinal, // ✅ CORRETO
        justificativa,
        manual: true,
        validado: true,
        registradoPor: req.user?.id || "GESTAO",
      },
      create: {
        opsId,
        dataReferencia: dataRef,
        idTipoAusencia: tipo.idTipoAusencia,
        horaEntrada: toTime(horaEntrada),
        horaSaida: horaSaidaFinal, // ✅ CORRETO
        justificativa,
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



module.exports = {
  registrarPontoCPF,
  getControlePresenca,
  ajusteManualPresenca,
};
