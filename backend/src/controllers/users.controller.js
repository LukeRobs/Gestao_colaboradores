/**
 * Controller de Usuários
 * ADMIN → full
 * LIDERANCA → read-only
 */

const { prisma } = require('../config/database');
const {
  successResponse,
  errorResponse,
  createdResponse,
} = require('../utils/response');

/**
 * LISTAR USUÁRIOS
 * ADMIN + LIDERANCA (consulta)
 */
const list = async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return successResponse(res, users);
};

/**
 * BUSCAR USUÁRIO POR ID
 * ADMIN + LIDERANCA (consulta)
 */
const getById = async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user)
    return errorResponse(res, 'Usuário não encontrado', 404);

  return successResponse(res, user);
};

/**
 * CRIAR USUÁRIO
 * SOMENTE ADMIN
 */
const create = async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing)
    return errorResponse(res, 'Email já cadastrado', 409);

  const hashedPassword = await require('../utils/hash').hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return createdResponse(res, user, 'Usuário criado com sucesso');
};

/**
 * ATUALIZAR USUÁRIO
 * SOMENTE ADMIN
 */
const update = async (req, res) => {
  const { id } = req.params;
  const { name, role, isActive } = req.body;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user)
    return errorResponse(res, 'Usuário não encontrado', 404);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name,
      role,
      isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return successResponse(res, updated, 'Usuário atualizado');
};

/**
 * ATIVAR / DESATIVAR USUÁRIO
 * SOMENTE ADMIN
 */
const toggleStatus = async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user)
    return errorResponse(res, 'Usuário não encontrado', 404);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive: !user.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  return successResponse(
    res,
    updated,
    `Usuário ${updated.isActive ? 'ativado' : 'desativado'}`
  );
};

module.exports = {
  list,
  getById,
  create,
  update,
  toggleStatus,
};
