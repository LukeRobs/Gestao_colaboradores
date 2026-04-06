const express = require('express');
const router = express.Router();
const controller = require('../controllers/turno.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', authenticate, asyncHandler(controller.getAllTurnos));
router.get('/:id', authenticate, asyncHandler(controller.getTurnoById));
router.post('/', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.createTurno));
router.put('/:id', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.updateTurno));
router.delete('/:id', authenticate, authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.deleteTurno));

module.exports = router;
