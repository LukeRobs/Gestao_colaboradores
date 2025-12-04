/**
 * Agregador de Rotas
 * Centraliza todas as rotas da aplicação
 */

const express = require('express');
const router = express.Router();

// Importar todas as rotas
const authRoutes = require('./auth.routes');
const empresaRoutes = require('./empresa.routes');
const setorRoutes = require('./setor.routes');
const cargoRoutes = require('./cargo.routes');
const estacaoRoutes = require('./estacao.routes');
const contratoRoutes = require('./contrato.routes');
const escalaRoutes = require('./escala.routes');
const turnoRoutes = require('./turno.routes');
const colaboradorRoutes = require('./colaboradores.routes');
const tipoausenciaRoutes = require('./tipoausencia.routes');
const frequenciaRoutes = require('./frequencia.routes');
const ausenciaRoutes = require('./ausencia.routes');
const dashboardRoutes = require('./dashboard.routes');
// Rota de health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API está funcionando!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Montar rotas com seus prefixos
router.use('/auth', authRoutes);
router.use('/empresas', empresaRoutes);
router.use('/setores', setorRoutes);
router.use('/cargos', cargoRoutes);
router.use('/estacoes', estacaoRoutes);
router.use('/contratos', contratoRoutes);
router.use('/escalas', escalaRoutes);
router.use('/turnos', turnoRoutes);
router.use('/colaboradores', colaboradorRoutes);
router.use('/tipos-ausencia', tipoausenciaRoutes);
router.use('/frequencias', frequenciaRoutes);
router.use('/ausencias', ausenciaRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
