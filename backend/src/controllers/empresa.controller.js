/**
 * Controller de Empresa
 * Gerencia operações CRUD de empresas
 */

const { prisma } = require('../config/database');
const {
  successResponse,
  createdResponse,
  deletedResponse,
  notFoundResponse,
  paginatedResponse,
} = require('../utils/response');

/**
 * Lista todas as empresas
 * GET /api/empresas
 */
const getAllEmpresas = async (req, res) => {
  const { page = 1, limit = 10, search, ativo } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const estacaoId = (!req.dbContext?.isGlobal && req.dbContext?.estacaoId)
    ? req.dbContext.estacaoId
    : null;

  const colaboradoresWhere = {
    status: 'ATIVO',
    ...(estacaoId ? { idEstacao: estacaoId } : {}),
  };

  const where = {};

  if (search) {
    where.OR = [
      { razaoSocial: { contains: search, mode: 'insensitive' } },
      { cnpj: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (ativo !== undefined) {
    where.ativo = ativo === 'true';
  }

  const [empresas, total] = await Promise.all([
    prisma.empresa.findMany({
      where,
      skip,
      take,
      orderBy: { dataCriacao: 'desc' },
      include: {
        _count: {
          select: {
            colaboradores: { where: colaboradoresWhere },
            contratos: true,
          },
        },
      },
    }),
    prisma.empresa.count({ where }),
  ]);

  return paginatedResponse(
    res,
    empresas,
    { page: parseInt(page), limit: parseInt(limit), total },
    'Empresas recuperadas com sucesso'
  );
};

/**
 * Busca uma empresa por ID
 * GET /api/empresas/:id
 */
const getEmpresaById = async (req, res) => {
  const { id } = req.params;

  const empresa = await prisma.empresa.findUnique({
    where: { idEmpresa: parseInt(id) },
    include: {
      colaboradores: {
        select: {
          opsId: true,
          nomeCompleto: true,
          matricula: true,
          status: true,
        },
        where: { status: 'ATIVO' },
      },
      contratos: {
        where: { ativo: true },
      },
      _count: {
        select: {
          colaboradores: true,
          contratos: true,
        },
      },
    },
  });

  if (!empresa) {
    return notFoundResponse(res, 'Empresa não encontrada');
  }

  return successResponse(res, empresa, 'Empresa recuperada com sucesso');
};

/**
 * Cria uma nova empresa
 * POST /api/empresas
 */
const createEmpresa = async (req, res) => {
  const { razaoSocial, cnpj, ativo } = req.body;

  const empresa = await prisma.empresa.create({
    data: {
      razaoSocial,
      cnpj,
      ativo: ativo !== undefined ? ativo : true,
    },
  });

  return createdResponse(res, empresa, 'Empresa criada com sucesso');
};

/**
 * Atualiza uma empresa
 * PUT /api/empresas/:id
 */
const updateEmpresa = async (req, res) => {
  const { id } = req.params;
  const { razaoSocial, cnpj, ativo } = req.body;

  const empresaExists = await prisma.empresa.findUnique({
    where: { idEmpresa: parseInt(id) },
  });

  if (!empresaExists) {
    return notFoundResponse(res, 'Empresa não encontrada');
  }

  const empresa = await prisma.empresa.update({
    where: { idEmpresa: parseInt(id) },
    data: {
      ...(razaoSocial && { razaoSocial }),
      ...(cnpj && { cnpj }),
      ...(ativo !== undefined && { ativo }),
    },
  });

  return successResponse(res, empresa, 'Empresa atualizada com sucesso');
};

/**
 * Deleta uma empresa
 * DELETE /api/empresas/:id
 */
const deleteEmpresa = async (req, res) => {
  const { id } = req.params;

  const empresaExists = await prisma.empresa.findUnique({
    where: { idEmpresa: parseInt(id) },
  });

  if (!empresaExists) {
    return notFoundResponse(res, 'Empresa não encontrada');
  }

  const total = await prisma.colaborador.count({ where: { idEmpresa: parseInt(id) } });
  if (total > 0) {
    return res.status(409).json({
      success: false,
      message: `Não é possível excluir esta empresa pois ela possui ${total} colaborador(es) vinculado(s).`,
    });
  }

  await prisma.empresa.delete({ where: { idEmpresa: parseInt(id) } });
  return deletedResponse(res, 'Empresa excluída com sucesso');
};

/**
 * Estatísticas da empresa
 * GET /api/empresas/:id/stats
 */
const getEmpresaStats = async (req, res) => {
  const { id } = req.params;

  const [empresa, stats] = await Promise.all([
    prisma.empresa.findUnique({
      where: { idEmpresa: parseInt(id) },
    }),
    prisma.colaborador.groupBy({
      by: ['status'],
      where: { idEmpresa: parseInt(id) },
      _count: true,
    }),
  ]);

  if (!empresa) {
    return notFoundResponse(res, 'Empresa não encontrada');
  }

  const statusCount = stats.reduce((acc, curr) => {
    acc[curr.status] = curr._count;
    return acc;
  }, {});

  return successResponse(res, {
    empresa,
    colaboradores: statusCount,
    total: Object.values(statusCount).reduce((a, b) => a + b, 0),
  }, 'Estatísticas recuperadas com sucesso');
};

module.exports = {
  getAllEmpresas,
  getEmpresaById,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
  getEmpresaStats,
};
