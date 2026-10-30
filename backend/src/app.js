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
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');
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

// ⛔ CORS PADRÃO REMOVIDO — AGORA USAMOS ORIGENS MÚLTIPLAS
// app.use(cors(config.cors));

// -----------------------------------------------------
// ✅ CORS — PERMITIR MÚLTIPLAS ORIGENS (Vercel + Localhost)
// -----------------------------------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://gestao-colaboradores.vercel.app",
  // Origens extras (ex.: Cloudflare Pages) via env, separadas por virgula, sem barra final
  ...(process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean),
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite Postman, Insomnia, server-to-server
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("🚫 CORS bloqueado para origem:", origin);
      return callback(new Error("CORS bloqueado pelo servidor"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse de JSON e URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔍 MIDDLEWARE DE DEBUG PARA BODY (TEMPORÁRIO - REMOVA APÓS RESOLVER)
app.use('/api/acidentes/presign-upload', (req, res, next) => {
  console.log('🔍 [MIDDLEWARE] Método:', req.method);
  console.log('🔍 [MIDDLEWARE] Content-Type:', req.get('Content-Type'));
  console.log('🔍 [MIDDLEWARE] Body cru (antes do controller):', JSON.stringify(req.body, null, 2));
  console.log('🔍 [MIDDLEWARE] Tipo de req.body:', typeof req.body);
  console.log('🔍 [MIDDLEWARE] req.body.files é array?', Array.isArray(req.body.files));
  next();
});

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
app.use('/api', globalLimiter);
app.use('/api', routes);

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

// 404 - Rota não encontrada
app.use(notFound);

// Error handler global
app.use(errorHandler);

module.exports = app;