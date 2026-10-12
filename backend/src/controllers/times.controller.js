const { prisma } = require("../config/database");
const { successResponse, errorResponse, notFoundResponse } = require("../utils/response");
const { validarColaboradorElegivel, contextoDaOperacao } = require("../services/mapaOperacional/colaboradorElegibilidade.service");

// Funções permitidas por operação (FIFO não exige função — ver regra especial).
const FUNCOES_POR_OPERACAO = {
  INBOUND: ["RECEIVED", "PULL", "LOG_II", "VOLANTE"],
  OUTBOUND: ["CONFERENTE", "PUSH", "LOG_II", "VOLANTE"],
};

const colaboradorSelect = {
  opsId: true,
  nomeCompleto: true,
  cargo: { select: { nomeCargo: true } },
};

/* =====================================================
   TIMES (cadastro reutilizável — composição é dinâmica)
===================================================== */
const listarTimes = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { operacao, turno } = req.query;

    const times = await prisma.timeOperacional.findMany({
      where: {
        idEstacao,
        ativo: true,
        ...(operacao ? { operacao } : {}),
        ...(turno ? { turno } : {}),
      },
      include: {
        integrantes: { include: { colaborador: { select: colaboradorSelect } } },
      },
      orderBy: [{ operacao: "asc" }, { nome: "asc" }],
    });

    // Doca em que cada time está alocado agora (null = livre): quem lista usa para travar a escolha.
    const emDoca = await prisma.mapaAlocacao.findMany({
      where: { idEstacao, fim: null, idTime: { in: times.map((t) => t.idTime) } },
      select: { idTime: true, numeroDoca: true },
    });
    const docaPorTime = new Map(emDoca.map((a) => [a.idTime, a.numeroDoca]));

    return successResponse(
      res,
      times.map((t) => ({ ...t, docaAtual: docaPorTime.get(t.idTime) ?? null }))
    );
  } catch (err) {
    console.error("❌ Erro ao listar times:", err);
    return errorResponse(res, "Erro ao listar times", 500);
  }
};

const criarTime = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { nome, operacao, tipo = "OPERACIONAL", turno } = req.body;

    if (!nome || !operacao || !turno) {
      return errorResponse(res, "Informe nome, operação e turno", 400);
    }
    if (!["INBOUND", "OUTBOUND"].includes(operacao)) {
      return errorResponse(res, "Operação inválida", 400);
    }
    if (!["OPERACIONAL", "FIFO"].includes(tipo)) {
      return errorResponse(res, "Tipo de time inválido", 400);
    }
    // FIFO é uma particularidade do Recebimento — não existe FIFO de Expedição.
    if (tipo === "FIFO" && operacao !== "INBOUND") {
      return errorResponse(res, "FIFO é exclusivo de times de Recebimento", 400);
    }

    const existente = await prisma.timeOperacional.findFirst({ where: { idEstacao, nome } });
    if (existente) return errorResponse(res, "Já existe um time com esse nome", 400);

    const time = await prisma.timeOperacional.create({
      data: { idEstacao, nome, operacao, tipo, turno },
      include: { integrantes: true },
    });

    return successResponse(res, time, "Time criado com sucesso");
  } catch (err) {
    console.error("❌ Erro ao criar time:", err);
    return errorResponse(res, "Erro ao criar time", 500);
  }
};

const atualizarTime = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idTime } = req.params;
    const { nome, turno, tipo } = req.body;

    const time = await prisma.timeOperacional.findFirst({
      where: { idTime: Number(idTime), idEstacao, ativo: true },
      include: { _count: { select: { integrantes: true } } },
    });
    if (!time) return notFoundResponse(res, "Time não encontrado");

    const data = {};

    if (nome !== undefined) {
      const novoNome = String(nome).trim();
      if (!novoNome) return errorResponse(res, "Informe o nome do time", 400);
      if (novoNome !== time.nome) {
        const duplicado = await prisma.timeOperacional.findFirst({ where: { idEstacao, nome: novoNome, ativo: true } });
        if (duplicado) return errorResponse(res, "Já existe um time com esse nome", 400);
        data.nome = novoNome;
      }
    }

    if (turno !== undefined) {
      if (!["T1", "T2", "T3"].includes(turno)) return errorResponse(res, "Turno inválido", 400);
      data.turno = turno;
    }

    if (tipo !== undefined && tipo !== time.tipo) {
      if (!["OPERACIONAL", "FIFO"].includes(tipo)) return errorResponse(res, "Tipo de time inválido", 400);
      if (tipo === "FIFO" && time.operacao !== "INBOUND") {
        return errorResponse(res, "FIFO é exclusivo de times de Recebimento", 400);
      }
      // Funções dos integrantes dependem do tipo (FIFO não tem função) — trocar
      // com gente já no time deixaria as funções inconsistentes.
      if (time._count.integrantes > 0) {
        return errorResponse(res, "Remova os integrantes antes de trocar o tipo do time", 400);
      }
      data.tipo = tipo;
    }

    const atualizado = await prisma.timeOperacional.update({
      where: { idTime: time.idTime },
      data,
      include: { integrantes: { include: { colaborador: { select: colaboradorSelect } } } },
    });

    return successResponse(res, atualizado, "Time atualizado com sucesso");
  } catch (err) {
    console.error("❌ Erro ao atualizar time:", err);
    return errorResponse(res, "Erro ao atualizar time", 500);
  }
};

// Desativa (não apaga) — alocações antigas de doca e histórico continuam
// apontando pro time.
const excluirTime = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idTime } = req.params;

    const time = await prisma.timeOperacional.findFirst({ where: { idTime: Number(idTime), idEstacao, ativo: true } });
    if (!time) return notFoundResponse(res, "Time não encontrado");

    const emDoca = await prisma.mapaAlocacao.findFirst({ where: { idEstacao, idTime: time.idTime, fim: null } });
    if (emDoca) {
      return errorResponse(res, `Este time está alocado na Doca ${emDoca.numeroDoca}. Libere a doca antes de excluir.`, 400);
    }

    // Renomeia junto: o nome é único por estação e senão ficaria preso a um time excluído.
    await prisma.timeOperacional.update({
      where: { idTime: time.idTime },
      data: { ativo: false, nome: `${time.nome} (excluído #${time.idTime})` },
    });
    return successResponse(res, null, "Time excluído com sucesso");
  } catch (err) {
    console.error("❌ Erro ao excluir time:", err);
    return errorResponse(res, "Erro ao excluir time", 500);
  }
};

const atualizarIntegrante = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idTime, opsId } = req.params;
    const { funcao } = req.body;

    const time = await prisma.timeOperacional.findFirst({ where: { idTime: Number(idTime), idEstacao, ativo: true } });
    if (!time) return notFoundResponse(res, "Time não encontrado");
    if (time.tipo === "FIFO") return errorResponse(res, "Time FIFO não tem função por integrante", 400);

    const permitidas = FUNCOES_POR_OPERACAO[time.operacao] || [];
    if (!funcao || !permitidas.includes(funcao)) {
      return errorResponse(res, `Função inválida para esse time — use: ${permitidas.join(" ou ")}`, 400);
    }

    const resultado = await prisma.timeIntegrante.updateMany({ where: { idTime: time.idTime, opsId }, data: { funcao } });
    if (resultado.count === 0) return notFoundResponse(res, "Integrante não encontrado nesse time");

    return successResponse(res, null, "Função atualizada com sucesso");
  } catch (err) {
    console.error("❌ Erro ao atualizar integrante:", err);
    return errorResponse(res, "Erro ao atualizar integrante", 500);
  }
};

const adicionarIntegrante = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idTime } = req.params;
    const { opsId, funcao } = req.body;

    const time = await prisma.timeOperacional.findFirst({ where: { idTime: Number(idTime), idEstacao } });
    if (!time) return notFoundResponse(res, "Time não encontrado");

    if (!opsId) return errorResponse(res, "Informe o colaborador (opsId)", 400);

    // FIFO não tem função fixa — não exige Received/Pull/Conferente/Push.
    if (time.tipo !== "FIFO") {
      const permitidas = FUNCOES_POR_OPERACAO[time.operacao] || [];
      if (!funcao || !permitidas.includes(funcao)) {
        return errorResponse(res, `Função inválida para esse time — use: ${permitidas.join(" ou ")}`, 400);
      }
    }

    const { colaborador, erro } = await validarColaboradorElegivel(opsId, {
      contexto: contextoDaOperacao(time.operacao),
      turno: time.turno,
    });
    if (!colaborador) return notFoundResponse(res, "Colaborador não encontrado");
    if (erro) return errorResponse(res, erro, 400);

    const jaNoTime = await prisma.timeIntegrante.findUnique({
      where: { idTime_opsId: { idTime: time.idTime, opsId } },
    });
    if (jaNoTime) return errorResponse(res, `${colaborador.nomeCompleto} já faz parte desse time`, 400);

    await prisma.timeIntegrante.create({
      data: { idTime: time.idTime, opsId, funcao: time.tipo === "FIFO" ? null : funcao },
    });

    const timeAtualizado = await prisma.timeOperacional.findUnique({
      where: { idTime: time.idTime },
      include: { integrantes: { include: { colaborador: { select: colaboradorSelect } } } },
    });

    return successResponse(res, timeAtualizado, "Integrante adicionado com sucesso");
  } catch (err) {
    console.error("❌ Erro ao adicionar integrante:", err);
    return errorResponse(res, "Erro ao adicionar integrante", 500);
  }
};

const removerIntegrante = async (req, res) => {
  try {
    const idEstacao = req.dbContext?.estacaoId ?? 1;
    const { idTime, opsId } = req.params;

    const time = await prisma.timeOperacional.findFirst({ where: { idTime: Number(idTime), idEstacao } });
    if (!time) return notFoundResponse(res, "Time não encontrado");

    await prisma.timeIntegrante.deleteMany({ where: { idTime: time.idTime, opsId } });

    return successResponse(res, null, "Integrante removido com sucesso");
  } catch (err) {
    console.error("❌ Erro ao remover integrante:", err);
    return errorResponse(res, "Erro ao remover integrante", 500);
  }
};

module.exports = {
  listarTimes,
  criarTime,
  atualizarTime,
  excluirTime,
  adicionarIntegrante,
  atualizarIntegrante,
  removerIntegrante,
};
