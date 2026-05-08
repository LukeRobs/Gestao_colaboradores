const express = require("express");
const router = express.Router();

const treinamentoController = require("../controllers/treinamento.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

/* =====================================================
   TREINAMENTOS
===================================================== */

/* LISTAR PARTICIPANTES POR SETOR */
router.get(
  "/participantes",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.listParticipantesPorSetor
);

/* CRIAR TREINAMENTO */
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.createTreinamento
);

/* STATS TREINAMENTOS */
router.get(
  "/stats",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.statsTreinamentos
);

/* LISTAR TREINAMENTOS */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.listTreinamentos
);

/* PRESIGN UPLOAD ATA */
router.post(
  "/:id/presign-ata",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.presignUploadAta
);

/* PRESIGN DOWNLOAD ATA */
router.get(
  "/:id/presign-download",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.presignDownloadAta
);

/* ATUALIZAR PARTICIPANTES */
router.put(
  "/:id/participantes",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.atualizarParticipantes
);

/* FINALIZAR TREINAMENTO */
router.post(
  "/:id/finalizar",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.finalizarTreinamento
);

/* CANCELAR TREINAMENTO */
router.post(
  "/:id/cancelar",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.cancelarTreinamento
);

module.exports = router;
