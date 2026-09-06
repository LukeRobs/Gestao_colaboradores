/**
 * Middleware de Contexto de Estação
 * Injeta req.dbContext para uso nos controllers.
 * ADMIN tem acesso global (sem filtro de estação) e pode navegar entre estações via ?estacaoId=X.
 * ALTA_GESTAO e LIDERANCA veem a estação definida no banco (idEstacao) — mas se essa
 * estação tiver uma "irmã" (ver config/estacaoGrupos.js), também podem trocar pra ela
 * via ?estacaoId=X, com o mesmo nível de acesso.
 */

const { prisma } = require('../config/database');
const { getEstacoesDoGrupo } = require('../config/estacaoGrupos');

const GLOBAL_ROLES = ['ADMIN'];

const injectDbContext = async (req, res, next) => {
  if (!req.user) return next();

  const isAdmin = req.user.role === 'ADMIN';

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
  } else {
    // Cobre ALTA_GESTAO e LIDERANCA — fixados na própria estação, mas podem
    // trocar pra uma estação "irmã" (ex: Jaboatão <-> Recife) via ?estacaoId=X.
    const home = req.user.idEstacao ?? null;
    const permitidas = getEstacoesDoGrupo(home); // [home] se não tiver irmã, ou o grupo inteiro
    const estacaoEfetiva = (estacaoIdParam && permitidas.includes(estacaoIdParam))
      ? estacaoIdParam
      : home;

    req.dbContext = {
      isGlobal: false,
      estacaoId: estacaoEfetiva,
    };
  }

  next();
};

module.exports = { injectDbContext };
