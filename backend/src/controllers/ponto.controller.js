// src/controllers/ponto.controller.js
const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  errorResponse,
} = require("../utils/response");

/* =====================================================
   HELPERS
===================================================== */

// "âncora" pra salvar time-only no Postgres (campo @db.Time)
function toTimeOnly(dateObj) {
  const d = new Date(dateObj);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
}

function startOfDay(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  return d;
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

/**
 * Dia operacional por turno:
 * - Usa o horarioInicio do turno cadastrado (db.Time)
 * - Se agora < inicio do turno => pertence ao dia anterior
 * - Isso funciona inclusive pro T3 (21:00) quando o cara bate 02:00 => 02:00 < 21:00 => dia anterior
 */
function getDataOperacionalPorTurno(agora, turno) {
  const base = new Date(agora);

  // fallback (caso turno não venha)
  if (!turno?.horarioInicio) {
    // mantém a regra antiga 06:00 como fallback
    const ref = new Date(base.getTime() - 6 * 60 * 60 * 1000);
    return startOfDay(ref);
  }

  const inicioMin = timeToMinutes(turno.horarioInicio);
  const agoraMin = nowToMinutes(base);

  if (agoraMin < inicioMin) base.setDate(base.getDate() - 1);

  return startOfDay(base);
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
    const { cpf } = req.body;

    console.log(`[${reqId}] registrarPontoCPF body:`, { cpf });

    if (!cpf) return errorResponse(res, "CPF não informado", 400);

    const agora = new Date();

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

    if (colaborador.status !== "ATIVO")
      return errorResponse(res, "Colaborador não está ativo", 400);

    /* ==========================================
       DIA OPERACIONAL (POR TURNO)
    ========================================== */
    const dataReferencia = getDataOperacionalPorTurno(
      agora,
      colaborador.turno
    );

    console.log(
      `[${reqId}] opsId=${colaborador.opsId} turno=${colaborador.turno?.nomeTurno}`
    );
    console.log(
      `[${reqId}] agora=${agora.toISOString()} dataReferencia=${ymd(
        dataReferencia
      )}`
    );

    /* ==========================================
       BLOQUEIOS (DSR / AUSÊNCIA / ATESTADO)
    ========================================== */
    if (isDiaDSR(dataReferencia, colaborador.escala?.nomeEscala)) {
      return errorResponse(
        res,
        "Hoje é DSR. Se for hora extra, solicite ajuste manual.",
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

    /* ==========================================
       BUSCA FREQUÊNCIA DO DIA
    ========================================== */
    const existente = await prisma.frequencia.findFirst({
      where: {
        opsId: colaborador.opsId,
        dataReferencia,
      },
    });

    const horaAgora = toTimeOnly(agora);

    /* ==========================================
       1ª BATIDA → ENTRADA
    ========================================== */
    if (!existente) {
      const tipoPresenca = await prisma.tipoAusencia.findFirst({
        where: { codigo: "P" },
      });

      const registro = await prisma.frequencia.create({
        data: {
          opsId: colaborador.opsId,
          dataReferencia,
          horaEntrada: horaAgora,
          idTipoAusencia: tipoPresenca?.idTipoAusencia ?? null,
          registradoPor: colaborador.opsId,
          validado: false,
        },
      });

      console.log(`[${reqId}] ENTRADA registrada`, registro.idFrequencia);

      return createdResponse(res, registro, "Entrada registrada com sucesso");
    }

    /* ==========================================
       2ª BATIDA → SAÍDA
    ========================================== */
    if (existente.horaEntrada && !existente.horaSaida) {
      const entradaMin = timeToMinutes(existente.horaEntrada);
      const saidaMin = nowToMinutes(agora);

      let minutosTrabalhados = saidaMin - entradaMin;
      if (minutosTrabalhados < 0) {
        // virou o dia (T3)
        minutosTrabalhados += 24 * 60;
      }

      const horasTrabalhadas = Number(
        (minutosTrabalhados / 60).toFixed(2)
      );

      const atualizado = await prisma.frequencia.update({
        where: { idFrequencia: existente.idFrequencia },
        data: {
          horaSaida: horaAgora,
          horasTrabalhadas,
        },
      });

      console.log(`[${reqId}] SAÍDA registrada`, atualizado.idFrequencia);

      return successResponse(
        res,
        atualizado,
        "Saída registrada com sucesso"
      );
    }

    /* ==========================================
       3ª BATIDA → BLOQUEIO
    ========================================== */
    return errorResponse(
      res,
      "Ponto do dia já está completo (entrada e saída)",
      409
    );
  } catch (err) {
    console.error(`[${reqId}] ❌ ERRO registrarPontoCPF:`, err);
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
    const { mes, turno, escala, search } = req.query;

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
      ...(turno && turno !== "TODOS" ? { turno: { nomeTurno: turno } } : {}),
      ...(escala && escala !== "TODOS" ? { escala: { nomeEscala: escala } } : {}),
      ...(search
        ? { nomeCompleto: { contains: String(search), mode: "insensitive" } }
        : {}),
    };

    const colaboradores = await prisma.colaborador.findMany({
      where: whereColaborador,
      include: { turno: true, escala: true },
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

      if (!freqMap[key]) {
        diasMap[dataISO] = {
          status: isDiaDSR(dataCalendario, c.escala?.nomeEscala) ? "DSR" : "F",
          manual: false,
        };
        continue;
      }

        const f = freqMap[key];
        diasMap[dataISO] = {
          status: f.tipoAusencia?.codigo || "P",
          entrada: f.horaEntrada,
          saida: f.horaSaida,
          validado: f.validado,
          manual: f.manual ?? false, // ✅ CORRETO
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
    const { opsId, dataReferencia, status, justificativa } = req.body;

    if (!opsId || !dataReferencia || !status || !justificativa) {
      return errorResponse(
        res,
        "Campos obrigatórios: opsId, dataReferencia, status, justificativa",
        400
      );
    }

    const colaborador = await prisma.colaborador.findFirst({
      where: { opsId },
    });

    if (!colaborador) {
      return notFoundResponse(res, "Colaborador não encontrado");
    }

    const tipo = await prisma.tipoAusencia.findUnique({
      where: { codigo: status },
    });

    if (!tipo) {
      return errorResponse(res, `Status inválido: ${status}`, 400);
    }

    // ✅ FIX DE DATA (SEM UTC)
    const [y, m, d] = dataReferencia.split("-").map(Number);
    const dataRef = new Date(y, m - 1, d);
    dataRef.setHours(0, 0, 0, 0);

    const registro = await prisma.frequencia.upsert({
      where: {
        opsId_dataReferencia: {
          opsId,
          dataReferencia: dataRef,
        },
      },
      update: {
        idTipoAusencia: tipo.idTipoAusencia,
        justificativa,
        manual: true,
        registradoPor: "GESTAO",
      },
      create: {
        opsId,
        dataReferencia: dataRef,
        idTipoAusencia: tipo.idTipoAusencia,
        justificativa,
        manual: true,
        registradoPor: "GESTAO",
      },
    });

    return successResponse(res, registro, "Ajuste manual realizado com sucesso");
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
