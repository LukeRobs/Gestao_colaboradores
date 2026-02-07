const express = require('express');
const router = express.Router();
const {
  getDadosSafetyWalk,
  getInspecaoById,
  sincronizarManual,
  exportarDados,
} = require('../controllers/safetyWalk.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Rotas do Safety Walk
 * Base: /api/safety-walk
 */

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/safety-walk - Buscar dados com filtros
router.get('/', getDadosSafetyWalk);

// GET /api/safety-walk/export - Exportar dados
router.get('/export', exportarDados);

// POST /api/safety-walk/sync - Sincronizar manualmente
router.post('/sync', sincronizarManual);

// GET /api/safety-walk/:id - Buscar inspeção específica
router.get('/:id', getInspecaoById);

module.exports = router;
