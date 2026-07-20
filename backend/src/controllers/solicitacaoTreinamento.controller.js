const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
  paginatedResponse,
} = require("../utils/response");
const { sendSolicitacaoTreinamentoEmail } = require("../reports/email");

class HttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

/* =====================================================
   HELPERS
===================================================== */
function normalizeDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function overlaps(aInicio, aFim, bInicio, bFim) {
  const ai = toMinutes(aInicio);
  const af = toMinutes(aFim);
  const bi = toMinutes(bInicio);
  const bf = toMinutes(bFim);
  if (ai == null || af == null || bi == null || bf == null) return false;
  return ai < bf && bi < af;
}

/**
 * Um aprovador só pode decidir solicitações da própria estação —
 * exceto quem tem idEstacao null (aprovador global, só Admin cadastra).
 */
async function isAprovadorAtivo(email, idEstacaoSolicitacao) {
  if (!email) return false;
  const aprovador = await prisma.aprovadorTreinamento.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      ativo: true,
      OR: [{ idEstacao: idEstacaoSolicitacao ?? null }, { idEstacao: null }],
    },
  });
  return !!aprovador;
}

/**
 * Validações inteligentes — não bloqueantes.
 * Retorna uma lista de avisos textuais sobre possíveis conflitos.
 */
async function checkConflitos({
  dataTreinamento,
  horarioInicio,
  horarioFim,
  idSetor,
  participantesOpsIds = [],
  solicitanteOpsId,
  excluirIdSolicitacao,
}) {
  const avisos = [];

  const treinamentosSetor = await prisma.treinamento.findMany({
    where: {
      dataTreinamento,
      status: { not: "CANCELADO" },
      setores: { some: { idSetor } },
    },
    select: { tema: true, horarioInicio: true, horarioFim: true },
  });
  for (const t of treinamentosSetor) {
    if (overlaps(horarioInicio, horarioFim, t.horarioInicio, t.horarioFim)) {
      avisos.push(`Já existe o treinamento "${t.tema}" agendado para o mesmo setor no mesmo horário.`);
    }
  }

  const outrasSolicitacoes = await prisma.solicitacaoTreinamento.findMany({
    where: {
      dataTreinamento,
      status: { in: ["PENDENTE", "APROVADA"] },
      idSetor,
      ...(excluirIdSolicitacao ? { idSolicitacao: { not: excluirIdSolicitacao } } : {}),
    },
    select: { tema: true, horarioInicio: true, horarioFim: true },
  });
  for (const s of outrasSolicitacoes) {
    if (overlaps(horarioInicio, horarioFim, s.horarioInicio, s.horarioFim)) {
      avisos.push(`Já existe a solicitação "${s.tema}" para o mesmo setor no mesmo horário.`);
    }
  }

  if (participantesOpsIds.length > 0) {
    const participantesConflitantes = await prisma.treinamentoParticipante.findMany({
      where: {
        opsId: { in: participantesOpsIds },
        treinamento: { dataTreinamento, status: { not: "CANCELADO" } },
      },
      select: {
        colaborador: { select: { nomeCompleto: true } },
        treinamento: { select: { tema: true, horarioInicio: true, horarioFim: true } },
      },
    });
    for (const p of participantesConflitantes) {
      if (overlaps(horarioInicio, horarioFim, p.treinamento.horarioInicio, p.treinamento.horarioFim)) {
        avisos.push(`${p.colaborador.nomeCompleto} já está alocado no treinamento "${p.treinamento.tema}" no mesmo horário.`);
      }
    }
  }

  if (solicitanteOpsId) {
    const treinamentosInstrutor = await prisma.treinamento.findMany({
      where: {
        dataTreinamento,
        status: { not: "CANCELADO" },
        liderResponsavelOpsId: solicitanteOpsId,
      },
      select: { tema: true, horarioInicio: true, horarioFim: true },
    });
    for (const t of treinamentosInstrutor) {
      if (overlaps(horarioInicio, horarioFim, t.horarioInicio, t.horarioFim)) {
        avisos.push(`O solicitante já possui o treinamento "${t.tema}" agendado no mesmo horário.`);
      }
    }
  }

  return avisos;
}

function estacaoWhereSolicitacao(req) {
  return !req.dbContext?.isGlobal && req.dbContext?.estacaoId
    ? { setor: { idEstacao: req.dbContext.estacaoId } }
    : {};
}

/**
 * Usado em buscas por ID (que não passam pelo where da listagem):
 * bloqueia acesso a registros de outra estação. Setores legados sem
 * idEstacao (null) ficam visíveis para todos, como no resto do sistema.
 */
function pertenceAEstacaoDoUsuario(req, idEstacaoRegistro) {
  if (req.dbContext?.isGlobal || !req.dbContext?.estacaoId) return true;
  if (!idEstacaoRegistro) return true;
  return idEstacaoRegistro === req.dbContext.estacaoId;
}

/* =====================================================
   LISTAR SOLICITAÇÕES
===================================================== */
exports.listSolicitacoes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      dataInicio,
      dataFim,
      idSetor,
      idTurno,
      processo,
      tema,
      solicitante,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = { ...estacaoWhereSolicitacao(req) };
    if (status) where.status = status;
    if (idSetor) where.idSetor = Number(idSetor);
    if (idTurno) where.idTurno = Number(idTurno);
    if (processo) where.processo = { contains: processo, mode: "insensitive" };
    if (tema) where.tema = { contains: tema, mode: "insensitive" };
    if (solicitante) where.solicitante = { name: { contains: solicitante, mode: "insensitive" } };
    if (dataInicio || dataFim) {
      where.dataTreinamento = {};
      if (dataInicio) where.dataTreinamento.gte = new Date(`${dataInicio}T00:00:00.000Z`);
      if (dataFim) where.dataTreinamento.lte = new Date(`${dataFim}T23:59:59.999Z`);
    }

    const [solicitacoes, total] = await Promise.all([
      prisma.solicitacaoTreinamento.findMany({
        where,
        orderBy: { dataTreinamento: "desc" },
        skip,
        take: limitNum,
        include: {
          setor: { select: { nomeSetor: true } },
          turno: { select: { nomeTurno: true } },
          solicitante: { select: { name: true } },
          decididoPor: { select: { name: true } },
          participantes: { select: { opsId: true } },
        },
      }),
      prisma.solicitacaoTreinamento.count({ where }),
    ]);

    return paginatedResponse(res, solicitacoes, { page: pageNum, limit: limitNum, total });
  } catch (err) {
    console.error("❌ listSolicitacoes:", err);
    return errorResponse(res, "Erro ao listar solicitações", 500);
  }
};

/* =====================================================
   ESTATÍSTICAS (CARDS DO DASHBOARD)
===================================================== */
exports.statsSolicitacoes = async (req, res) => {
  try {
    const estacaoWhere = estacaoWhereSolicitacao(req);

    const treinamentoWhere = !req.dbContext?.isGlobal && req.dbContext?.estacaoId
      ? { liderResponsavel: { idEstacao: req.dbContext.estacaoId } }
      : {};

    const hoje = new Date();
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);

    const [pendentes, aprovadas, negadas, agendadosSemana] = await Promise.all([
      prisma.solicitacaoTreinamento.count({ where: { ...estacaoWhere, status: "PENDENTE" } }),
      prisma.solicitacaoTreinamento.count({ where: { ...estacaoWhere, status: "APROVADA" } }),
      prisma.solicitacaoTreinamento.count({ where: { ...estacaoWhere, status: "NEGADA" } }),
      prisma.treinamento.count({
        where: {
          ...treinamentoWhere,
          status: { not: "CANCELADO" },
          dataTreinamento: { gte: hoje, lte: em7dias },
        },
      }),
    ]);

    return successResponse(res, { pendentes, aprovadas, negadas, agendadosSemana });
  } catch (err) {
    console.error("❌ statsSolicitacoes:", err);
    return errorResponse(res, "Erro ao buscar estatísticas", 500);
  }
};

/* =====================================================
   GRÁFICOS DO DASHBOARD
===================================================== */
exports.statsGraficos = async (req, res) => {
  try {
    const solicitacoes = await prisma.solicitacaoTreinamento.findMany({
      where: estacaoWhereSolicitacao(req),
      select: {
        processo: true,
        dataCriacao: true,
        decididoEm: true,
        setor: { select: { nomeSetor: true } },
        turno: { select: { nomeTurno: true } },
      },
    });

    const porSetor = {};
    const porProcesso = {};
    const porTurno = {};
    const porMes = {};
    let somaMinutos = 0;
    let countDecididas = 0;

    for (const s of solicitacoes) {
      const setorNome = s.setor?.nomeSetor || "Sem setor";
      porSetor[setorNome] = (porSetor[setorNome] || 0) + 1;

      porProcesso[s.processo] = (porProcesso[s.processo] || 0) + 1;

      const turnoNome = s.turno?.nomeTurno || "Sem turno";
      porTurno[turnoNome] = (porTurno[turnoNome] || 0) + 1;

      const mesRef = s.dataCriacao.toISOString().slice(0, 7);
      porMes[mesRef] = (porMes[mesRef] || 0) + 1;

      if (s.decididoEm) {
        somaMinutos += (new Date(s.decididoEm) - new Date(s.dataCriacao)) / 60000;
        countDecididas++;
      }
    }

    return successResponse(res, {
      porSetor: Object.entries(porSetor).map(([label, total]) => ({ label, total })),
      porProcesso: Object.entries(porProcesso).map(([label, total]) => ({ label, total })),
      porTurno: Object.entries(porTurno).map(([label, total]) => ({ label, total })),
      evolucaoMensal: Object.entries(porMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, total]) => ({ mes, total })),
      tempoMedioAprovacaoMinutos: countDecididas > 0 ? Math.round(somaMinutos / countDecididas) : null,
    });
  } catch (err) {
    console.error("❌ statsGraficos:", err);
    return errorResponse(res, "Erro ao buscar gráficos", 500);
  }
};

/* =====================================================
   BUSCAR SOLICITAÇÃO POR ID
===================================================== */
exports.getSolicitacao = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitacao = await prisma.solicitacaoTreinamento.findUnique({
      where: { idSolicitacao: Number(id) },
      include: {
        setor: { select: { nomeSetor: true, idEstacao: true } },
        turno: { select: { nomeTurno: true } },
        solicitante: { select: { name: true, email: true, opsId: true } },
        decididoPor: { select: { name: true, email: true } },
        treinamentoCriado: { select: { idTreinamento: true } },
        participantes: {
          include: {
            colaborador: {
              select: {
                nomeCompleto: true,
                cpf: true,
                matricula: true,
                cargo: { select: { nomeCargo: true } },
                setor: { select: { nomeSetor: true } },
              },
            },
          },
        },
        historico: { orderBy: { criadoEm: "asc" } },
      },
    });

    if (!solicitacao || !pertenceAEstacaoDoUsuario(req, solicitacao.setor?.idEstacao)) {
      return notFoundResponse(res, "Solicitação não encontrada");
    }

    const podeDecidir =
      solicitacao.status === "PENDENTE" &&
      (await isAprovadorAtivo(req.user.email, solicitacao.setor?.idEstacao));

    return successResponse(res, { ...solicitacao, podeDecidir });
  } catch (err) {
    console.error("❌ getSolicitacao:", err);
    return errorResponse(res, "Erro ao buscar solicitação", 500);
  }
};

/* =====================================================
   CALENDÁRIO — fonte única de dados (colorido por status)
===================================================== */
exports.listarCalendario = async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim) {
      return errorResponse(res, "Parâmetros inicio e fim são obrigatórios", 400);
    }

    const where = {
      dataTreinamento: {
        gte: new Date(`${inicio}T00:00:00.000Z`),
        lte: new Date(`${fim}T23:59:59.999Z`),
      },
      ...estacaoWhereSolicitacao(req),
    };

    const solicitacoes = await prisma.solicitacaoTreinamento.findMany({
      where,
      select: {
        idSolicitacao: true,
        tema: true,
        processo: true,
        dataTreinamento: true,
        horarioInicio: true,
        horarioFim: true,
        tempoPrevistoMinutos: true,
        status: true,
        observacoes: true,
        idTreinamentoCriado: true,
        setor: { select: { nomeSetor: true } },
        turno: { select: { nomeTurno: true } },
        solicitante: { select: { name: true } },
        participantes: { select: { opsId: true } },
      },
      orderBy: { dataTreinamento: "asc" },
    });

    return successResponse(res, solicitacoes);
  } catch (err) {
    console.error("❌ listarCalendario:", err);
    return errorResponse(res, "Erro ao buscar calendário", 500);
  }
};

/* =====================================================
   VALIDAR CONFLITOS (pré-checagem, não bloqueante)
===================================================== */
exports.validarConflitos = async (req, res) => {
  try {
    const { dataTreinamento, horarioInicio, horarioFim, idSetor, participantes = [] } = req.body;

    if (!dataTreinamento || !horarioInicio || !horarioFim || !idSetor) {
      return successResponse(res, { avisos: [] });
    }

    const participantesOpsIds = (participantes || [])
      .map((p) => (typeof p === "string" ? p : p.opsId))
      .filter(Boolean);

    const avisos = await checkConflitos({
      dataTreinamento: normalizeDateOnly(dataTreinamento),
      horarioInicio,
      horarioFim,
      idSetor: Number(idSetor),
      participantesOpsIds,
      solicitanteOpsId: req.user.opsId,
    });

    return successResponse(res, { avisos });
  } catch (err) {
    console.error("❌ validarConflitos:", err);
    return errorResponse(res, "Erro ao validar conflitos", 500);
  }
};

/* =====================================================
   CRIAR SOLICITAÇÃO
===================================================== */
exports.createSolicitacao = async (req, res) => {
  try {
    const {
      dataTreinamento,
      horarioInicio,
      horarioFim,
      tempoPrevistoMinutos,
      idSetor,
      idTurno,
      hcPrevisto,
      motivo,
      tema,
      processo,
      observacoes,
      participantes = [],
    } = req.body;

    if (!dataTreinamento || !horarioInicio || !horarioFim || !idSetor || !motivo || !tema || !processo) {
      return errorResponse(res, "Campos obrigatórios não informados", 400);
    }

    if (!req.user?.opsId) {
      return errorResponse(res, "Usuário logado não está vinculado a um colaborador (ops_id). Não é possível criar solicitações.", 400);
    }

    // Impede criar solicitação para um setor de outra estação
    if (!req.dbContext?.isGlobal && req.dbContext?.estacaoId) {
      const setorValido = await prisma.setor.findFirst({
        where: {
          idSetor: Number(idSetor),
          OR: [{ idEstacao: req.dbContext.estacaoId }, { idEstacao: null }],
        },
        select: { idSetor: true },
      });
      if (!setorValido) {
        return errorResponse(res, "Setor inválido para a sua estação", 400);
      }
    }

    const dataNormalizada = normalizeDateOnly(dataTreinamento);
    const participantesOpsIds = (participantes || [])
      .map((p) => (typeof p === "string" ? p : p.opsId))
      .filter(Boolean);

    const avisos = await checkConflitos({
      dataTreinamento: dataNormalizada,
      horarioInicio,
      horarioFim,
      idSetor: Number(idSetor),
      participantesOpsIds,
      solicitanteOpsId: req.user.opsId,
    });

    const solicitacao = await prisma.$transaction(async (tx) => {
      const nova = await tx.solicitacaoTreinamento.create({
        data: {
          dataTreinamento: dataNormalizada,
          horarioInicio,
          horarioFim,
          tempoPrevistoMinutos: tempoPrevistoMinutos ? Number(tempoPrevistoMinutos) : null,
          idSetor: Number(idSetor),
          idTurno: idTurno ? Number(idTurno) : null,
          hcPrevisto: hcPrevisto ? Number(hcPrevisto) : null,
          motivo,
          tema,
          processo,
          observacoes: observacoes || null,
          solicitanteUserId: req.user.id,
          participantes: {
            create: participantesOpsIds.map((opsId) => ({ opsId })),
          },
        },
      });

      const eventos = [{ idSolicitacao: nova.idSolicitacao, evento: `Solicitação criada por ${req.user.name}` }];
      if (avisos.length > 0) {
        eventos.push({
          idSolicitacao: nova.idSolicitacao,
          evento: `Alertas de conflito identificados: ${avisos.join(" | ")}`,
        });
      }
      await tx.solicitacaoTreinamentoHistorico.createMany({ data: eventos });

      return nova;
    });

    // Notificação por e-mail — não bloqueia a criação da solicitação em caso de falha
    try {
      const setor = await prisma.setor.findUnique({
        where: { idSetor: Number(idSetor) },
        select: { nomeSetor: true, idEstacao: true },
      });

      // Só aprovadores da mesma estação do setor (+ aprovadores globais)
      const aprovadoresAtivos = await prisma.aprovadorTreinamento.findMany({
        where: {
          ativo: true,
          OR: [{ idEstacao: setor?.idEstacao ?? null }, { idEstacao: null }],
        },
      });
      if (aprovadoresAtivos.length > 0) {
        await sendSolicitacaoTreinamentoEmail({
          to: aprovadoresAtivos.map((a) => a.email),
          solicitacao: {
            idSolicitacao: solicitacao.idSolicitacao,
            tema,
            processo,
            dataTreinamento: dataNormalizada,
            horarioInicio,
            horarioFim,
            solicitanteNome: req.user.name,
            setorNome: setor?.nomeSetor,
            qtdParticipantes: participantesOpsIds.length,
          },
        });

        await prisma.solicitacaoTreinamentoHistorico.create({
          data: { idSolicitacao: solicitacao.idSolicitacao, evento: "E-mails enviados aos aprovadores" },
        });
      }
    } catch (emailErr) {
      console.error("⚠️ Falha ao enviar email de solicitação de treinamento:", emailErr.message);
    }

    return createdResponse(res, { ...solicitacao, avisos }, "Solicitação criada com sucesso");
  } catch (err) {
    console.error("❌ createSolicitacao:", err);
    return errorResponse(res, "Erro ao criar solicitação", 500);
  }
};

/* =====================================================
   APROVAR SOLICITAÇÃO
   Regra: o primeiro aprovador ativo que agir vence. Update
   condicional atômico (status = PENDENTE) evita corrida entre
   dois aprovadores agindo simultaneamente.
===================================================== */
exports.aprovarSolicitacao = async (req, res) => {
  try {
    const idSolicitacao = Number(req.params.id);

    const solicitacaoAtual = await prisma.solicitacaoTreinamento.findUnique({
      where: { idSolicitacao },
      select: { setor: { select: { idEstacao: true } } },
    });

    if (!solicitacaoAtual || !pertenceAEstacaoDoUsuario(req, solicitacaoAtual.setor?.idEstacao)) {
      return notFoundResponse(res, "Solicitação não encontrada");
    }

    const autorizado = await isAprovadorAtivo(req.user.email, solicitacaoAtual.setor?.idEstacao);
    if (!autorizado) {
      return errorResponse(res, "Você não está cadastrado como aprovador.", 403);
    }

    const novoTreinamento = await prisma.$transaction(async (tx) => {
      const claimed = await tx.solicitacaoTreinamento.updateMany({
        where: { idSolicitacao, status: "PENDENTE" },
        data: { status: "APROVADA", decididoPorUserId: req.user.id, decididoEm: new Date() },
      });

      if (claimed.count === 0) {
        throw new HttpError("Esta solicitação já foi analisada por outro responsável.", 409);
      }

      const solicitacao = await tx.solicitacaoTreinamento.findUnique({
        where: { idSolicitacao },
        include: {
          participantes: true,
          setor: { select: { nomeSetor: true, estacao: { select: { nomeEstacao: true } } } },
          solicitante: { select: { opsId: true, name: true } },
        },
      });

      if (!solicitacao.solicitante?.opsId) {
        throw new HttpError(
          "O solicitante não está vinculado a um colaborador (ops_id); não é possível criar o treinamento automaticamente.",
          400
        );
      }

      const treinamento = await tx.treinamento.create({
        data: {
          dataTreinamento: solicitacao.dataTreinamento,
          processo: solicitacao.processo,
          tema: solicitacao.tema,
          soc: solicitacao.setor?.estacao?.nomeEstacao || solicitacao.setor?.nomeSetor || "N/A",
          liderResponsavelOpsId: solicitacao.solicitante.opsId,
          horarioInicio: solicitacao.horarioInicio,
          horarioFim: solicitacao.horarioFim,
          idTurno: solicitacao.idTurno,
          tempoPrevistoMinutos: solicitacao.tempoPrevistoMinutos,
          observacoes: solicitacao.observacoes,
          criadoPor: req.user.id,
          setores: { create: [{ idSetor: solicitacao.idSetor }] },
          participantes: {
            create: solicitacao.participantes.map((p) => ({ opsId: p.opsId, adicionadoPor: req.user.id })),
          },
        },
      });

      await tx.solicitacaoTreinamento.update({
        where: { idSolicitacao },
        data: { idTreinamentoCriado: treinamento.idTreinamento },
      });

      await tx.solicitacaoTreinamentoHistorico.createMany({
        data: [
          { idSolicitacao, evento: `Solicitação aprovada por ${req.user.name}` },
          { idSolicitacao, evento: "Treinamento criado automaticamente" },
        ],
      });

      return treinamento;
    });

    return successResponse(
      res,
      { idTreinamento: novoTreinamento.idTreinamento },
      "Solicitação aprovada e treinamento criado"
    );
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(res, err.message, err.statusCode);
    }
    console.error("❌ aprovarSolicitacao:", err);
    return errorResponse(res, "Erro ao aprovar solicitação", 500);
  }
};

/* =====================================================
   NEGAR SOLICITAÇÃO
===================================================== */
exports.negarSolicitacao = async (req, res) => {
  try {
    const idSolicitacao = Number(req.params.id);
    const { motivo } = req.body;

    if (!motivo?.trim()) {
      return errorResponse(res, "Motivo da negativa é obrigatório", 400);
    }

    const solicitacaoAtual = await prisma.solicitacaoTreinamento.findUnique({
      where: { idSolicitacao },
      select: { setor: { select: { idEstacao: true } } },
    });

    if (!solicitacaoAtual || !pertenceAEstacaoDoUsuario(req, solicitacaoAtual.setor?.idEstacao)) {
      return notFoundResponse(res, "Solicitação não encontrada");
    }

    const autorizado = await isAprovadorAtivo(req.user.email, solicitacaoAtual.setor?.idEstacao);
    if (!autorizado) {
      return errorResponse(res, "Você não está cadastrado como aprovador.", 403);
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.solicitacaoTreinamento.updateMany({
        where: { idSolicitacao, status: "PENDENTE" },
        data: {
          status: "NEGADA",
          decididoPorUserId: req.user.id,
          decididoEm: new Date(),
          motivoNegativa: motivo.trim(),
        },
      });

      if (claimed.count === 0) {
        throw new HttpError("Esta solicitação já foi analisada por outro responsável.", 409);
      }

      await tx.solicitacaoTreinamentoHistorico.create({
        data: {
          idSolicitacao,
          evento: `Solicitação negada por ${req.user.name} — Motivo: ${motivo.trim()}`,
        },
      });
    });

    return successResponse(res, null, "Solicitação negada");
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(res, err.message, err.statusCode);
    }
    console.error("❌ negarSolicitacao:", err);
    return errorResponse(res, "Erro ao negar solicitação", 500);
  }
};
