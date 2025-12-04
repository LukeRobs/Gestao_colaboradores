/**
 * Controller de Autenticação - COMPLETO E CORRIGIDO
 */

const { prisma } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');
const {
  successResponse,
  errorResponse,
  createdResponse,
} = require('../utils/response');

/**
 * REGISTRO
 */
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return errorResponse(res, 'Email já cadastrado', 409);

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role || 'USER',
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

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return createdResponse(res, { user, token }, 'Usuário registrado com sucesso');
};

/**
 * LOGIN
 */
const login = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;

  console.log("📩 Login recebido:", { email, password });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });

  console.log("📌 Usuário buscado no banco:", user);

  if (!user || !user.password)
    return errorResponse(res, 'Email ou senha incorretos', 401);

  if (!user.isActive)
    return errorResponse(res, 'Usuário inativo', 401);

  const isValid = await comparePassword(password, user.password);

  if (!isValid)
    return errorResponse(res, 'Email ou senha incorretos', 401);

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  const { password: _, ...safeUser } = user;

  return successResponse(res, { user: safeUser, token }, 'Login realizado com sucesso');
};

/**
 * GET USER LOGADO
 */
const getMe = async (req, res) => {
  if (!req.user)
    return errorResponse(res, 'Nenhuma sessão válida encontrada', 401);

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
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

  return successResponse(res, user);
};

/**
 * UPDATE PROFILE
 */
const updateMe = async (req, res) => {
  if (!req.user)
    return errorResponse(res, 'Nenhuma sessão válida encontrada', 401);

  const { name, avatar } = req.body;

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, avatar },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      updatedAt: true,
    },
  });

  return successResponse(res, updated, 'Perfil atualizado');
};

/**
 * ALTERA SENHA
 */
const changePassword = async (req, res) => {
  if (!req.user)
    return errorResponse(res, 'Nenhuma sessão válida encontrada', 401);

  const { senhaAtual, novaSenha } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  const isMatch = await comparePassword(senhaAtual, user.password);
  if (!isMatch)
    return errorResponse(res, 'Senha atual incorreta', 401);

  const hashed = await hashPassword(novaSenha);

  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashed },
  });

  return successResponse(res, null, 'Senha alterada com sucesso');
};

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
};
