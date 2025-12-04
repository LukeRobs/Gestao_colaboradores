const express = require('express');
const router = express.Router();
const controller = require('../controllers/colaborador.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', authenticate, asyncHandler(controller.getAllColaboradores));
router.get('/:opsId', authenticate, asyncHandler(controller.getColaboradorById));
router.get('/:opsId/stats', authenticate, asyncHandler(controller.getColaboradorStats));
router.get('/:opsId/historico', authenticate, asyncHandler(controller.getColaboradorHistorico));
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(controller.createColaborador));
router.put('/:opsId', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(controller.updateColaborador));
router.delete('/:opsId', authenticate, authorize('ADMIN'), asyncHandler(controller.deleteColaborador));

module.exports = router;
