/**
 * Agregador de Rotas
 */

const express = require("express");
const router = express.Router();

const { authenticate } = require("../middlewares/auth.middleware");
const blockOperacao = require("../middlewares/blockOperacao");

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
   🔓 ROTAS PÚBLICAS
========================= */
router.use("/auth", authRoutes);

// 🔓 CPF – NÃO PASSA POR AUTH
router.post(
  "/ponto/registrar",
  require("../controllers/ponto.controller").registrarPontoCPF
);

/* =========================
   🔐 ROTAS PROTEGIDAS
========================= */
router.use(authenticate);
router.use(blockOperacao);

router.use("/empresas", empresaRoutes);
router.use("/setores", setorRoutes);
router.use("/cargos", cargoRoutes);
router.use("/estacoes", estacaoRoutes);
router.use("/contratos", contratoRoutes);
router.use("/escalas", escalaRoutes);
router.use("/turnos", turnoRoutes);
router.use("/colaboradores", colaboradorRoutes);
router.use("/tipos-ausencia", tipoausenciaRoutes);
router.use("/frequencias", frequenciaRoutes);
router.use("/ausencias", ausenciaRoutes);
router.use("/dashboard", dashboardRoutes);

// agora sim, resto do ponto
router.use("/ponto", pontoRoutes);

router.use("/atestados-medicos", atestadoMedicoRoutes);
router.use("/medidas-disciplinares", medidaDisciplinarRoutes);
router.use("/acidentes", acidentesRoutes);
router.use("/dashboard/admin", dashboardAdminRoutes);
router.use("/regionais", regionalRoutes);
router.use("/dashboard/colaboradores", dashboardColaboradores);
router.use("/treinamentos", treinamentoRoutes);
router.use("/dw", dwRoutes);
router.use("/users", usersRoutes);
router.use("/safety-walk", safetyWalkRoutes);

module.exports = router;
