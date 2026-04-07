const express = require('express');
const router = express.Router();
const controller = require('../controllers/escala.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', authenticate, asyncHandler(controller.getAllEscalas));
router.get('/:id', authenticate, asyncHandler(controller.getEscalaById));
router.post('/', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.createEscala));
router.put('/:id', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.updateEscala));
router.delete('/:id', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.deleteEscala));

module.exports = router;
