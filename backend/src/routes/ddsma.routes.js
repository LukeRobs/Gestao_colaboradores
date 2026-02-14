const express = require('express');
const router = express.Router();
const {
  getDadosDDSMA,
  getRegistroById,
  sincronizarManual,
  exportarDados,
} = require('../controllers/ddsma.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Rotas do DDSMA
 * Base: /api/ddsma
 */

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/ddsma - Buscar dados com filtros
router.get('/', getDadosDDSMA);

// GET /api/ddsma/export - Exportar dados
router.get('/export', exportarDados);

// POST /api/ddsma/sync - Sincronizar manualmente
router.post('/sync', sincronizarManual);

// GET /api/ddsma/:id - Buscar registro específico
router.get('/:id', getRegistroById);

module.exports = router;
