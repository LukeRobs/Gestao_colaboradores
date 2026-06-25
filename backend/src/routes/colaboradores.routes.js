const express = require("express");
const router = express.Router();

const controller = require("../controllers/colaborador.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../middlewares/error.middleware");
const { upload } = require("../middlewares/uploadCsv.middleware");

/* ================= BACKFILL DSR ================= */
router.post(
  "/backfill-dsr",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(controller.backfillDSRTodos)
);

/* ================= BACKFILL NC PRÉ-ADMISSÃO ================= */
router.post(
  "/backfill-nc-pre-admissao",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(controller.backfillNcPreAdmissao)
);

/* ================= IMPORT CSV ================= */
router.post(
  "/import",
  authenticate,
  authorize("ADMIN", "MANAGER", "ALTA_GESTAO"),
  upload.single("file"),
  asyncHandler(controller.importColaboradores)
);

router.get(
  "/import-status", 
  authenticate,
  authorize("ADMIN", "MANAGER", "ALTA_GESTAO"),
  asyncHandler(controller.getStatusImport)
);
/* ================= LÍDERES ================= */
router.get(
  "/lideres",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  asyncHandler(controller.listarLideres)
);

/* ================= ESCALAS ================= */

router.get(
  "/escalas",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  asyncHandler(controller.listarEscalas)
);

/* ================= SETORES ================= */
router.get(
  "/setores",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  asyncHandler(controller.listarSetores)
);

/* ================= FILTROS DA ESTAÇÃO (escalas/turnos/setores/cargos) ================= */
router.get(
  "/filtros",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  asyncHandler(controller.listarFiltrosEstacao)
);

/* ================= EXPORT CSV ================= */
router.get(
  "/export/csv",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  asyncHandler(controller.exportarCsvColaboradores)
);

/* ================= CPF (⚠️ TEM QUE VIR ANTES DE :opsId) ================= */
router.get(
  "/cpf/:cpf",
  authenticate,
  asyncHandler(controller.getColaboradorByCpf)
);

/* ================= LISTAGEM ================= */
router.get(
  "/",
  authenticate,
  asyncHandler(controller.getAllColaboradores)
);

/* ================= STATS / HISTÓRICO ================= */
router.get(
  "/:opsId/stats",
  authenticate,
  asyncHandler(controller.getColaboradorStats)
);

router.get(
  "/:opsId/historico",
  authenticate,
  asyncHandler(controller.getColaboradorHistorico)
);

/* ================= GET / UPDATE / DELETE POR OPS ID ================= */
router.get(
  "/:opsId",
  authenticate,
  asyncHandler(controller.getColaboradorById)
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN", "MANAGER", "ALTA_GESTAO"),
  asyncHandler(controller.createColaborador)
);

router.put(
  "/:opsId",
  authenticate,
  authorize("ADMIN", "MANAGER", "ALTA_GESTAO"),
  asyncHandler(controller.updateColaborador)
);

router.post(
  "/:opsId/movimentar",
  authenticate,
  authorize("ADMIN", "MANAGER", "ALTA_GESTAO"),
  asyncHandler(controller.movimentarColaborador)
);

router.delete(
  "/:opsId",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(controller.deleteColaborador)
);

module.exports = router;
