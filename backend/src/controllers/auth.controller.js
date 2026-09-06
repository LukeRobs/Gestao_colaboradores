/**
 * Controller de Autenticação - COMPLETO E CORRIGIDO
 */

const crypto = require('crypto');
const { prisma } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../reports/email');
const {
  successResponse,
  errorResponse,
  createdResponse,
} = require('../utils/response');
const { getEstacoesDoGrupo } = require('../config/estacaoGrupos');

/**
 * REGISTRO
 */
const register = async (req, res) => {
  const { name, email, password, opsId, idEstacao } = req.body;

  if (!name || !email || !password || !opsId) {
    return errorResponse(res, 'Nome, email, senha e Ops ID são obrigatórios', 400);
  }

  if (!idEstacao) {
    return errorResponse(res, 'Selecione uma estação', 400);
  }

  const emailLower = email.toLowerCase();
  const dominiosPermitidos = ['@shopee.com', '@shopeemobile-external.com'];
  if (!dominiosPermitidos.some(d => emailLower.endsWith(d))) {
    return errorResponse(res, 'O e-mail deve ser do domínio @shopee.com ou @shopeemobile-external.com', 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return errorResponse(res, 'Email já cadastrado', 409);

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'LIDERANCA',
      opsId: opsId.trim(),
      ...(idEstacao ? { idEstacao: parseInt(idEstacao) } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      opsId: true,
      idEstacao: true,
      isActive: true,
      createdAt: true,
    },
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    idEstacao: user.idEstacao ?? null,
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
    role: user.role,
    idEstacao: user.idEstacao ?? null,
  });

  const { password: _, ...safeUser } = user;
  const estacoesIrmas = getEstacoesDoGrupo(user.idEstacao);

  return successResponse(res, { user: { ...safeUser, estacoesIrmas }, token }, 'Login realizado com sucesso');
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
      idEstacao: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return errorResponse(res, 'Usuário não encontrado', 404);

  return successResponse(res, { ...user, estacoesIrmas: getEstacoesDoGrupo(user.idEstacao) });
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

/**
 * ESQUECI MINHA SENHA — gera token e envia e-mail
 */
const forgotPassword = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    return errorResponse(res, 'Informe o e-mail', 400);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  // Resposta sempre genérica, mesmo se o e-mail não existir (evita enumeração de usuários)
  const mensagemGenerica =
    'Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha.';

  if (!user || !user.isActive) {
    return successResponse(res, null, mensagemGenerica);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1h
    },
  });

  try {
    await sendPasswordResetEmail({ to: user.email, nome: user.name, token });
  } catch (err) {
    console.error('❌ Erro ao enviar e-mail de recuperação de senha:', err.message);
    return errorResponse(res, 'Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.', 500);
  }

  return successResponse(res, null, mensagemGenerica);
};

/**
 * REDEFINIR SENHA — valida token e grava nova senha
 */
const resetPassword = async (req, res) => {
  const { token, novaSenha } = req.body;

  if (!token || !novaSenha) {
    return errorResponse(res, 'Token e nova senha são obrigatórios', 400);
  }

  if (novaSenha.length < 6) {
    return errorResponse(res, 'A senha deve ter pelo menos 6 caracteres', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return errorResponse(res, 'Link inválido ou expirado. Solicite uma nova recuperação de senha.', 400);
  }

  const hashed = await hashPassword(novaSenha);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return successResponse(res, null, 'Senha redefinida com sucesso');
};

/**
 * LISTA ESTAÇÕES (público — usado no formulário de registro)
 */
const listarEstacoesPublico = async (req, res) => {
  const estacoes = await prisma.estacao.findMany({
    select: { idEstacao: true, nomeEstacao: true },
    orderBy: { nomeEstacao: 'asc' },
  });
  return successResponse(res, estacoes);
};

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  listarEstacoesPublico,
};
