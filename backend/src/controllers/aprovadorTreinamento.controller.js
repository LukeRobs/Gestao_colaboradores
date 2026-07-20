/**
 * Controller de Aprovadores de Treinamento
 * Cadastro simples usado para autorizar quem pode aprovar/negar
 * Solicitações de Treinamento (vínculo por e-mail do usuário logado).
 *
 * Multi-tenancy: cada aprovador pertence a uma estação (idEstacao).
 * Só o Admin pode cadastrar/editar um aprovador válido em "todas as
 * estações" (idEstacao = null) — os demais papéis ficam sempre
 * travados na própria estação (req.dbContext.estacaoId).
 */

const { prisma } = require("../config/database");
const {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");

function estacaoWhereAprovador(req) {
  return !req.dbContext?.isGlobal && req.dbContext?.estacaoId
    ? { OR: [{ idEstacao: req.dbContext.estacaoId }, { idEstacao: null }] }
    : {};
}

/** Resolve o idEstacao a gravar em create/update a partir do papel do usuário. */
function resolverIdEstacao(req, { idEstacaoAtual } = {}) {
  const isAdmin = req.user.role === "ADMIN";
  const informouIdEstacao = Object.prototype.hasOwnProperty.call(req.body, "idEstacao");

  if (isAdmin) {
    if (!informouIdEstacao) return { ok: true, value: idEstacaoAtual ?? null };
    const raw = req.body.idEstacao;
    const value = raw === null || raw === "" ? null : Number(raw);
    return { ok: true, value };
  }

  // Não-admin: sempre travado na própria estação, nunca pode ficar "global"
  const idEstacao = req.dbContext?.estacaoId ?? null;
  if (!idEstacao) {
    return { ok: false, message: "Selecione uma estação para o aprovador" };
  }
  return { ok: true, value: idEstacao };
}

/** true se o usuário pode ver/gerenciar este aprovador específico. */
function dentroDoEscopo(req, aprovador) {
  if (req.user.role === "ADMIN") return true;
  return !req.dbContext?.isGlobal && aprovador.idEstacao === req.dbContext?.estacaoId;
}

/* =====================================================
   LISTAR APROVADORES
===================================================== */
exports.listAprovadores = async (req, res) => {
  try {
    const { ativo } = req.query;

    const where = { ...estacaoWhereAprovador(req) };
    if (ativo !== undefined) where.ativo = ativo === "true";

    const aprovadores = await prisma.aprovadorTreinamento.findMany({
      where,
      include: { estacao: { select: { idEstacao: true, nomeEstacao: true } } },
      orderBy: { nome: "asc" },
    });

    return successResponse(res, aprovadores);
  } catch (err) {
    console.error("❌ listAprovadores:", err);
    return errorResponse(res, "Erro ao listar aprovadores", 500);
  }
};

/* =====================================================
   CRIAR APROVADOR
===================================================== */
exports.createAprovador = async (req, res) => {
  try {
    const { nome, email, ativo = true } = req.body;

    if (!nome?.trim() || !email?.trim()) {
      return errorResponse(res, "Nome e email são obrigatórios", 400);
    }

    const resolucao = resolverIdEstacao(req);
    if (!resolucao.ok) {
      return errorResponse(res, resolucao.message, 400);
    }

    const existente = await prisma.aprovadorTreinamento.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existente) {
      return errorResponse(res, "Já existe um aprovador com este email", 400);
    }

    const aprovador = await prisma.aprovadorTreinamento.create({
      data: {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        ativo: !!ativo,
        idEstacao: resolucao.value,
      },
      include: { estacao: { select: { idEstacao: true, nomeEstacao: true } } },
    });

    return createdResponse(res, aprovador, "Aprovador cadastrado com sucesso");
  } catch (err) {
    console.error("❌ createAprovador:", err);
    return errorResponse(res, "Erro ao criar aprovador", 500);
  }
};

/* =====================================================
   ATUALIZAR APROVADOR
===================================================== */
exports.updateAprovador = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, ativo } = req.body;

    const aprovador = await prisma.aprovadorTreinamento.findUnique({
      where: { idAprovador: Number(id) },
    });

    if (!aprovador || !dentroDoEscopo(req, aprovador)) {
      return notFoundResponse(res, "Aprovador não encontrado");
    }

    if (email && email.trim().toLowerCase() !== aprovador.email) {
      const existente = await prisma.aprovadorTreinamento.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existente) {
        return errorResponse(res, "Já existe um aprovador com este email", 400);
      }
    }

    const resolucao = resolverIdEstacao(req, { idEstacaoAtual: aprovador.idEstacao });
    if (!resolucao.ok) {
      return errorResponse(res, resolucao.message, 400);
    }

    const atualizado = await prisma.aprovadorTreinamento.update({
      where: { idAprovador: Number(id) },
      data: {
        ...(nome !== undefined ? { nome: nome.trim() } : {}),
        ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
        ...(ativo !== undefined ? { ativo: !!ativo } : {}),
        idEstacao: resolucao.value,
      },
      include: { estacao: { select: { idEstacao: true, nomeEstacao: true } } },
    });

    return successResponse(res, atualizado, "Aprovador atualizado com sucesso");
  } catch (err) {
    console.error("❌ updateAprovador:", err);
    return errorResponse(res, "Erro ao atualizar aprovador", 500);
  }
};

/* =====================================================
   DESATIVAR (remover) APROVADOR
===================================================== */
exports.deleteAprovador = async (req, res) => {
  try {
    const { id } = req.params;

    const aprovador = await prisma.aprovadorTreinamento.findUnique({
      where: { idAprovador: Number(id) },
    });

    if (!aprovador || !dentroDoEscopo(req, aprovador)) {
      return notFoundResponse(res, "Aprovador não encontrado");
    }

    await prisma.aprovadorTreinamento.update({
      where: { idAprovador: Number(id) },
      data: { ativo: false },
    });

    return successResponse(res, null, "Aprovador desativado com sucesso");
  } catch (err) {
    console.error("❌ deleteAprovador:", err);
    return errorResponse(res, "Erro ao desativar aprovador", 500);
  }
};
