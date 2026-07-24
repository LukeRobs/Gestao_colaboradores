/**
 * Agregador de Rotas
 */

const express = require("express");
const router = express.Router();

const { authenticate, authorize } = require("../middlewares/auth.middleware");
const { injectDbContext } = require("../middlewares/dbContext.middleware");
const blockOperacao = require("../middlewares/blockOperacao");
const {
  authLimiter,
  dashboardLimiter,
  reportLimiter,
  writeLimiter,
} = require("../middlewares/rateLimiter.middleware");

// rotas
const authRoutes = require("./auth.routes");
const pontoRoutes = require("./ponto.routes");

const empresaRoutes = require("./empresa.routes");
const setorRoutes = require("./setor.routes");
const cargoRoutes = require("./cargo.routes");
const estacaoRoutes = require("./estacao.routes");
const contratoRoutes = require("./contrato.routes");
const escalaRoutes = require("./escala.routes");
const turnoRoutes = require("./turno.routes");
const colaboradorRoutes = require("./colaboradores.routes");
const exportColaboradoresRoutes = require("./exportColaboradores.routes");
const tipoausenciaRoutes = require("./tipoausencia.routes");
const frequenciaRoutes = require("./frequencia.routes");
const ausenciaRoutes = require("./ausencia.routes");
const dashboardRoutes = require("./dashboard.routes");
const atestadoMedicoRoutes = require("./atestados.routes");
const medidaDisciplinarRoutes = require("./medidas-disciplinares.routes");
const acidentesRoutes = require("./acidentes.routes");
const dashboardAdminRoutes = require("./dashboardAdmin.routes");
const regionalRoutes = require("./regional.routes");
const dashboardColaboradores = require("./dashboardColaboradores.routes");
const treinamentoRoutes = require("./treinamento.routes");
const dwRoutes = require("./dw.routes");
const usersRoutes = require("./users.routes");
const safetyWalkRoutes = require("./safetyWalk.routes");
const reportRoutes = require("./reports.routes");
const dashboardAtestados = require("./dashboardAtestados.routes");
const ddsmaRoutes = require("./ddsma.routes");
const opaRoutes = require("./opa.routes");
const folgaDominical = require("./folgaDominical.routes");
const gestaoOperacionalRoutes = require("./gestaoOperacional.routes");
const processamentoGeralRoutes = require("./processamentoGeral.routes");
const sugestaoRoutes = require("./sugestaoMedidaDisciplinar.routes");
const desligamentoRoutes = require("./desligamentoDashboard.routes");
const dashboardFaltasRoutes = require("./faltas.routes")
const absenteismoRoutes     = require("./absenteismo.routes")
const esteirasRoutes        = require("./esteiras.routes")
const solicitacaoTreinamentoRoutes = require("./solicitacaoTreinamento.routes")
const aprovadorTreinamentoRoutes   = require("./aprovadorTreinamento.routes")

/* =========================
   HEALTH
========================= */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API está funcionando!",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/* =========================
   ENV CHECK (apenas para diagnóstico)
========================= */
router.get("/env-check", (req, res) => {
  const envVars = {
    // Variáveis críticas para email
    GMAIL_USER: !!process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
    
    // Variáveis críticas para R2
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
    R2_ENDPOINT: !!process.env.R2_ENDPOINT,
    
    // Outras variáveis importantes
    DATABASE_URL: !!process.env.DATABASE_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
  };

  const allConfigured = Object.values(envVars).every(v => v === true);
  const missingVars = Object.entries(envVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  res.json({
    success: allConfigured,
    message: allConfigured 
      ? "Todas as variáveis de ambiente estão configuradas" 
      : "Algumas variáveis de ambiente estão faltando",
    environment: process.env.NODE_ENV || 'development',
    configured: envVars,
    missing: missingVars,
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   🔓 ROTAS PÚBLICAS
========================= */
router.use("/auth", authLimiter, authRoutes);

// 🔓 VERSÃO DO SISTEMA — sem autenticação
router.get("/version", (req, res) => {
  res.json({
    success: true,
    version: process.env.APP_VERSION || "1.0.0",
  });
});

// 🔓 CPF – NÃO PASSA POR AUTH
router.post(
  "/ponto/registrar",
  require("../controllers/ponto.controller").registrarPontoCPF
);

/* =========================
   🔐 ROTAS PROTEGIDAS
========================= */
router.use(authenticate);
router.use(injectDbContext);
router.use(writeLimiter);
router.use(blockOperacao);

/* =========================
   DEBUG - TESTAR PLANILHA (requer ADMIN)
========================= */
router.get("/debug/planilha", authorize("ADMIN"), async (req, res) => {
  try {
    const { buscarQuantidadeRealizada } = require("../services/googleSheetsMetaProducao.service");
    const { data = "2026-06-03" } = req.query;

    console.log("🔍 DEBUG - Testando leitura da planilha para data:", data);
    const result = await buscarQuantidadeRealizada(data);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Erro no debug:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/* =========================
   LIMPAR CACHE DA PLANILHA (requer ADMIN)
========================= */
router.post("/cache/limpar", authorize("ADMIN"), async (req, res) => {
  try {
    const { limparCache } = require("../services/googleSheetsMetaProducao.service");
    limparCache();

    res.json({
      success: true,
      message: "Cache limpo com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Erro ao limpar cache:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.use("/empresas", empresaRoutes);
router.use("/setores", setorRoutes);
router.use("/cargos", cargoRoutes);
router.use("/estacoes", estacaoRoutes);
router.use("/contratos", contratoRoutes);
router.use("/escalas", escalaRoutes);
router.use("/turnos", turnoRoutes);
router.use("/colaboradores/export", exportColaboradoresRoutes);
router.use("/colaboradores", colaboradorRoutes);
router.use("/tipos-ausencia", tipoausenciaRoutes);
router.use("/frequencias", frequenciaRoutes);
router.use("/ausencias", ausenciaRoutes);
router.use("/dashboard", dashboardLimiter);
router.use("/dashboard", dashboardRoutes);

// agora sim, resto do ponto
router.use("/ponto", reportLimiter, pontoRoutes);

router.use("/atestados-medicos", atestadoMedicoRoutes);
router.use("/medidas-disciplinares/sugestoes", sugestaoRoutes);
router.use("/medidas-disciplinares", medidaDisciplinarRoutes);
router.use("/acidentes", acidentesRoutes);
router.use("/dashboard/admin", dashboardAdminRoutes);
router.use("/regionais", regionalRoutes);
router.use("/dashboard/colaboradores", dashboardColaboradores);
router.use("/treinamentos", treinamentoRoutes);
router.use("/dw", dwRoutes);
router.use("/users", usersRoutes);
router.use("/safety-walk", safetyWalkRoutes);
router.use("/reports", reportLimiter, reportRoutes);
router.use("/dashboard/atestados", dashboardAtestados);
router.use("/ddsma", ddsmaRoutes);
router.use("/opa", opaRoutes);
router.use("/folga-dominical", folgaDominical);
router.use("/dashboard/gestao-operacional", gestaoOperacionalRoutes);
router.use("/dashboard/processamento-geral", processamentoGeralRoutes);
router.use("/dashboard/desligamento", desligamentoRoutes)
router.use("/dashboard/faltas",       reportLimiter, dashboardFaltasRoutes)
router.use("/dashboard/absenteismo",  reportLimiter, absenteismoRoutes)
router.use("/esteiras",               esteirasRoutes)
router.use("/solicitacoes-treinamento", solicitacaoTreinamentoRoutes)
router.use("/config/aprovadores-treinamento", aprovadorTreinamentoRoutes)

module.exports = router;
