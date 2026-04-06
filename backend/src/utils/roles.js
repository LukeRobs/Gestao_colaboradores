/**
 * Helpers de autorização por role
 * ADMIN tem acesso global entre estações (bypass RLS)
 * ALTA_GESTAO tem visão ampla mas fixada na estação definida no banco
 */
const { authorizeRoles } = require('../middlewares/authorizeRoles');

// Roles com visão global (bypass RLS) - apenas ADMIN
const GLOBAL_ROLES = ['ADMIN'];

const onlyAdmin = authorizeRoles('ADMIN');

const adminOrAltaGestao = authorizeRoles('ADMIN', 'ALTA_GESTAO');

const adminAltaGestaoLideranca = authorizeRoles('ADMIN', 'ALTA_GESTAO', 'LIDERANCA');

const allRoles = authorizeRoles('ADMIN', 'ALTA_GESTAO', 'LIDERANCA', 'OPERACAO');

module.exports = {
  GLOBAL_ROLES,
  onlyAdmin,
  adminOrAltaGestao,
  adminAltaGestaoLideranca,
  allRoles,
};
