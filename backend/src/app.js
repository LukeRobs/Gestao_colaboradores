/**
 * Configuração Principal do Express
 * Define middlewares e rotas
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');
const cron = require("node-cron");

// ⚠️ AJUSTE O CAMINHO CONFORME SUA ESTRUTURA:
const { gerarAusenciasDiaOperacional } = require("./controllers/ponto.controller");

// Cria a aplicação Express
const app = express();

// =====================================================
// MIDDLEWARES GLOBAIS
// =====================================================

// Segurança com Helmet
app.use(helmet());

// CORS
app.use(cors(config.cors));

// Parse de JSON e URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger HTTP (Morgan)
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware de log customizado
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// =====================================================
// CRON JOB → gerar ausências todo dia às 06:05
// =====================================================

cron.schedule("5 6 * * *", async () => {
  try {
    console.log("⏰ Rodando job: gerarAusenciasDiaOperacional");
    await gerarAusenciasDiaOperacional();
  } catch (err) {
    console.error("❌ Erro no job de ausências:", err);
  }
});

// =====================================================
// ROTAS
// =====================================================

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API de Gestão de Colaboradores',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      colaboradores: '/api/colaboradores',
      empresas: '/api/empresas',
      setores: '/api/setores',
      cargos: '/api/cargos',
      frequencias: '/api/frequencias',
      ausencias: '/api/ausencias',
      docs: '/api/docs (em breve)',
    },
  });
});

// Monta as rotas da API
app.use('/api', routes);

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

// 404 - Rota não encontrada
app.use(notFound);

// Error handler global
app.use(errorHandler);

module.exports = app;
