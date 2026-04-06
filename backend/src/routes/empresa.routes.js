const express = require('express');
const router = express.Router();
const controller = require('../controllers/empresa.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', authenticate, asyncHandler(controller.getAllEmpresas));
router.get('/:id', authenticate, asyncHandler(controller.getEmpresaById));
router.get('/:id/stats', authenticate, asyncHandler(controller.getEmpresaStats));
router.post('/', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.createEmpresa));
router.put('/:id', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.updateEmpresa));
router.delete('/:id', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.deleteEmpresa));

module.exports = router;
