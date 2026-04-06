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

  // Filtro de estação: ADMIN global vê tudo, demais só a sua estação
  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
    ? req.dbContext.estacaoId
    : null;

  const colaboradoresWhere = {
    status: 'ATIVO',
    ...(estacaoId ? { idEstacao: estacaoId } : {}),
  };

  const where = {};

  if (search) {
    where.nomeSetor = { contains: search, mode: 'insensitive' };
  }

  if (ativo !== undefined) {
    where.ativo = ativo === 'true';
  }

  // Se filtrado por estação, só retorna setores que tenham ao menos 1 colaborador ativo nela
  if (estacaoId) {
    where.colaboradores = { some: colaboradoresWhere };
  }

  const [setores, total] = await Promise.all([
    prisma.setor.findMany({
      where,
      skip,
      take,
      orderBy: { nomeSetor: 'asc' },
      include: {
        _count: {
          select: {
            colaboradores: { where: colaboradoresWhere },
          },
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

  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
    ? req.dbContext.estacaoId
    : null;

  const colaboradoresWhere = {
    status: 'ATIVO',
    ...(estacaoId ? { idEstacao: estacaoId } : {}),
  };

  const setor = await prisma.setor.findUnique({
    where: { idSetor: Number(id) },
    include: {
      colaboradores: {
        where: colaboradoresWhere,
        select: {
          opsId: true,
          nomeCompleto: true,
          matricula: true,
          cargo: { select: { nomeCargo: true } },
        },
      },
      _count: {
        select: {
          colaboradores: { where: colaboradoresWhere },
        },
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
    totalColaboradores: setor._count.colaboradores,
    colaboradores: setor.colaboradores,
  });
};

/* ================= CREATE ================= */
const createSetor = async (req, res) => {
  const { nomeSetor, descricao, ativo } = req.body;

  const setor = await prisma.setor.create({
    data: {
      nomeSetor,
      descricao,
      ativo: ativo !== undefined ? ativo : true,
    },
  });

  return createdResponse(res, setor, 'Setor criado com sucesso');
};

/* ================= UPDATE ================= */
const updateSetor = async (req, res) => {
  const { id } = req.params;
  const { nomeSetor, descricao, ativo } = req.body;

  const setor = await prisma.setor.update({
    where: { idSetor: Number(id) },
    data: {
      ...(nomeSetor && { nomeSetor }),
      ...(descricao !== undefined && { descricao }),
      ...(ativo !== undefined && { ativo }),
    },
  });

  return successResponse(res, setor, 'Setor atualizado com sucesso');
};

/* ================= DELETE ================= */
const deleteSetor = async (req, res) => {
  const { id } = req.params;

  await prisma.setor.delete({
    where: { idSetor: Number(id) },
  });

  return deletedResponse(res, 'Setor excluído com sucesso');
};

module.exports = {
  getAllSetores,
  getSetorById,
  createSetor,
  updateSetor,
  deleteSetor,
};
