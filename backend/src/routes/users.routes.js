/**
 * Rotas de Usuários
 * /api/users
 */

const express = require('express');
const router = express.Router();

const usersController = require('../controllers/users.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/authorizeRoles');
const { asyncHandler } = require('../middlewares/error.middleware');

// 🔍 CONSULTA — ADMIN + LIDERANCA (READ ONLY)
router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'LIDERANCA'),
  asyncHandler(usersController.list)
);

router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'LIDERANCA'),
  asyncHandler(usersController.getById)
);

// ✏️ GESTÃO — SOMENTE ADMIN
router.post(
  '/',
  authenticate,
  authorizeRoles('ADMIN'),
  asyncHandler(usersController.create)
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN'),
  asyncHandler(usersController.update)
);

router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('ADMIN'),
  asyncHandler(usersController.toggleStatus)
);

module.exports = router;
