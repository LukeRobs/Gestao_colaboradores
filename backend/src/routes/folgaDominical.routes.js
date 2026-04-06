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
  GERAR → apenas ADMIN
===================================================== */
router.post(
  "/",
  authorizeRoles("ADMIN"),
  controller.gerar
);

/* =====================================================
  DELETE → apenas ADMIN
===================================================== */
router.delete(
  "/",
  authorizeRoles("ADMIN"),
  controller.deletar
);

module.exports = router;