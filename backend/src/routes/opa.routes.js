const express = require('express');
const router = express.Router();
const { getOPA } = require('../controllers/opa.controller');
const onlyEstacao = require('../middlewares/onlyEstacao');

/**
 * Rotas do OPA (Observação Preventiva de Atos)
 * Base: /api/opa
 * Restrito à estação 1 — authenticate e injectDbContext já aplicados globalmente
 */

router.use(onlyEstacao([1]));

// GET /api/opa - Buscar dados com filtros
router.get('/', getOPA);

module.exports = router;
