const express = require('express');
const router = express.Router();
const controller = require('../controllers/setor.controller');
const { authorize } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', asyncHandler(controller.getAllSetores));
router.get('/:id', asyncHandler(controller.getSetorById));
router.post('/', authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.createSetor));
router.put('/:id', authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.updateSetor));
router.delete('/:id', authorize('ADMIN', 'ALTA_GESTAO'), asyncHandler(controller.deleteSetor));

module.exports = router;
