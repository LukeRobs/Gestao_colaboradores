/**
 * Controller de Setor
 * Gerencia operações CRUD de setores
 */

const { prisma } = require('../config/database');
const {
  successResponse,
  createdResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse,
} = require('../utils/response');

/* ================= GET ALL ================= */
const getAllSetores = async (req, res) => {
  const { page = 1, limit = 10, search, ativo } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
    ? req.dbContext.estacaoId
    : null;

  const where = {};

  if (search) {
    where.nomeSetor = { contains: search, mode: 'insensitive' };
  }

  if (ativo !== undefined) {
    where.ativo = ativo === 'true';
  }

  // Filtra diretamente pelo idEstacao do setor
  // Setores sem estação (legado) são visíveis para todos
  if (estacaoId) {
    where.OR = [
      { idEstacao: estacaoId },
      { idEstacao: null },
    ];
  }

  const [setores, total] = await Promise.all([
    prisma.setor.findMany({
      where,
      skip,
      take,
      orderBy: { nomeSetor: 'asc' },
      include: {
        _count: {
          select: { colaboradores: { where: { status: 'ATIVO' } } },
        },
      },
    }),
    prisma.setor.count({ where }),
  ]);

  const data = setores.map((s) => ({
    idSetor: s.idSetor,
    nomeSetor: s.nomeSetor,
    descricao: s.descricao,
    ativo: s.ativo,
    idEstacao: s.idEstacao,
    totalColaboradores: s._count.colaboradores,
  }));

  return paginatedResponse(res, data, {
    page: Number(page),
    limit: Number(limit),
    total,
  });
};

/* ================= GET BY ID ================= */
const getSetorById = async (req, res) => {
  const { id } = req.params;

  const setor = await prisma.setor.findUnique({
    where: { idSetor: Number(id) },
    include: {
      colaboradores: {
        where: { status: 'ATIVO' },
        select: {
          opsId: true,
          nomeCompleto: true,
          matricula: true,
          cargo: { select: { nomeCargo: true } },
        },
      },
      _count: {
        select: { colaboradores: { where: { status: 'ATIVO' } } },
      },
    },
  });

  if (!setor) {
    return notFoundResponse(res, 'Setor não encontrado');
  }

  return successResponse(res, {
    idSetor: setor.idSetor,
    nomeSetor: setor.nomeSetor,
    descricao: setor.descricao,
    ativo: setor.ativo,
    idEstacao: setor.idEstacao,
    totalColaboradores: setor._count.colaboradores,
    colaboradores: setor.colaboradores,
  });
};

/* ================= CREATE ================= */
const createSetor = async (req, res) => {
  const { nomeSetor, descricao, ativo, idEstacao: idEstacaoBody } = req.body;

  // Prioridade: body (ADMIN escolheu no modal) > dbContext (estação selecionada/fixada)
  const idEstacao = idEstacaoBody ? Number(idEstacaoBody) : (req.dbContext?.estacaoId ?? null);

  try {
    const setor = await prisma.setor.create({
      data: {
        nomeSetor,
        descricao,
        ativo: ativo !== undefined ? ativo : true,
        ...(idEstacao ? { idEstacao } : {}),
      },
    });

    return createdResponse(res, setor, 'Setor criado com sucesso');
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Já existe um setor com este nome nesta estação.' });
    }
    throw error;
  }
};

/* ================= UPDATE ================= */
const updateSetor = async (req, res) => {
  const { id } = req.params;
  const { nomeSetor, descricao, ativo } = req.body;

  try {
    const setor = await prisma.setor.update({
      where: { idSetor: Number(id) },
      data: {
        ...(nomeSetor && { nomeSetor }),
        ...(descricao !== undefined && { descricao }),
        ...(ativo !== undefined && { ativo }),
      },
    });

    return successResponse(res, setor, 'Setor atualizado com sucesso');
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Já existe um setor com este nome nesta estação.' });
    }
    throw error;
  }
};

/* ================= DELETE ================= */
const deleteSetor = async (req, res) => {
  const { id } = req.params;

  try {
    const total = await prisma.colaborador.count({
      where: { idSetor: Number(id) },
    });

    if (total > 0) {
      return res.status(409).json({
        success: false,
        message: `Não é possível excluir este setor pois ele possui ${total} colaborador(es) vinculado(s).`,
      });
    }

    await prisma.setor.delete({
      where: { idSetor: Number(id) },
    });

    return deletedResponse(res, 'Setor excluído com sucesso');
  } catch (error) {
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(409).json({
        success: false,
        message: 'Não é possível excluir este setor pois ele possui colaboradores vinculados.',
      });
    }
    throw error;
  }
};

module.exports = {
  getAllSetores,
  getSetorById,
  createSetor,
  updateSetor,
  deleteSetor,
};
