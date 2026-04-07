const express = require('express');
const router = express.Router();
const {
  getDadosDDSMA,
  getRegistroById,
  sincronizarManual,
  exportarDados,
} = require('../controllers/ddsma.controller');
const onlyEstacao = require('../middlewares/onlyEstacao');

/**
 * Rotas do DDSMA
 * Base: /api/ddsma
 * Restrito à estação 1 — authenticate e injectDbContext já aplicados globalmente
 */

router.use(onlyEstacao([1]));

// GET /api/ddsma - Buscar dados com filtros
router.get('/', getDadosDDSMA);

// GET /api/ddsma/export - Exportar dados
router.get('/export', exportarDados);

// POST /api/ddsma/sync - Sincronizar manualmente
router.post('/sync', sincronizarManual);

// GET /api/ddsma/:id - Buscar registro específico
router.get('/:id', getRegistroById);

module.exports = router;
