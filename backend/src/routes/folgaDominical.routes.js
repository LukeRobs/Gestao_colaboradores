const express = require("express");
const router = express.Router();

const controller = require("../controllers/folgaDominical.controller");
const { authorizeRoles } = require("../middlewares/authorizeRoles");

/* =====================================================
   👀 LISTAR → ADMIN + ALTA_GESTAO + LIDERANCA
===================================================== */
router.get(
  "/",
  authorizeRoles("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  controller.listar
);

/* =====================================================
  PREVIEW → ADMIN + ALTA_GESTAO + LIDERANCA
  (simulação sem salvar)
===================================================== */
router.post(
  "/preview",
  authorizeRoles("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  controller.preview
);

/* =====================================================
  GERAR → ADMIN + ALTA_GESTAO
===================================================== */
router.post(
  "/",
  authorizeRoles("ADMIN", "ALTA_GESTAO"),
  controller.gerar
);

/* =====================================================
  DELETE → ADMIN + ALTA_GESTAO
===================================================== */
router.delete(
  "/",
  authorizeRoles("ADMIN", "ALTA_GESTAO"),
  controller.deletar
);

module.exports = router;