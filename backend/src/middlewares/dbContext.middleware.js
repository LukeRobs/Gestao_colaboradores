/**
 * Middleware de Contexto de Estação
 * Injeta req.dbContext para uso nos controllers.
 * ADMIN tem acesso global (sem filtro de estação) e pode navegar entre estações via ?estacaoId=X.
 * ALTA_GESTAO vê os mesmos dados que ADMIN, mas fixado na estação definida no banco (idEstacao).
 */

const { prisma } = require('../config/database');

const GLOBAL_ROLES = ['ADMIN'];

const injectDbContext = async (req, res, next) => {
  if (!req.user) return next();

  const isAdmin = req.user.role === 'ADMIN';
  const isAltaGestao = req.user.role === 'ALTA_GESTAO';

  // ADMIN pode filtrar por estação via query param
  const estacaoIdParam = req.query.estacaoId ? Number(req.query.estacaoId) : null;

  if (isAdmin) {
    // Valida que a estação solicitada existe antes de aplicar o filtro
    if (estacaoIdParam) {
      const estacaoExiste = await prisma.estacao.findUnique({
        where: { idEstacao: estacaoIdParam },
        select: { idEstacao: true },
      });

      if (!estacaoExiste) {
        return res.status(404).json({ success: false, message: 'Estação não encontrada' });
      }
    }

    req.dbContext = {
      isGlobal: !estacaoIdParam,
      estacaoId: estacaoIdParam ?? null,
    };
  } else if (isAltaGestao) {
    // ALTA_GESTAO: visão ampla mas fixada na estação do banco
    req.dbContext = {
      isGlobal: false,
      estacaoId: req.user.idEstacao ?? null,
    };
  } else {
    req.dbContext = {
      isGlobal: false,
      estacaoId: req.user.idEstacao ?? null,
    };
  }

  next();
};

module.exports = { injectDbContext };
