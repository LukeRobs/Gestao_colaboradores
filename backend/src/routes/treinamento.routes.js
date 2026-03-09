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
  authorize("ADMIN", "GESTAO", "LIDERANCA"),
  treinamentoController.listParticipantesPorSetor
);

/* CRIAR TREINAMENTO */
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "GESTAO", "LIDERANCA"),
  treinamentoController.createTreinamento
);

/* LISTAR TREINAMENTOS */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "GESTAO", "LIDERANCA"),
  treinamentoController.listTreinamentos
);

/* PRESIGN ATA */
router.post(
  "/:id/presign-ata",
  authenticate,
  authorize("ADMIN", "GESTAO", "LIDERANCA"),
  treinamentoController.presignUploadAta
);

/* FINALIZAR TREINAMENTO */
router.post(
  "/:id/finalizar",
  authenticate,
  authorize("ADMIN", "GESTAO", "LIDERANCA"),
  treinamentoController.finalizarTreinamento
);

module.exports = router;