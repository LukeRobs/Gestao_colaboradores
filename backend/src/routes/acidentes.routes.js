const express = require("express");
const router = express.Router();

const controller = require("../controllers/acidente.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../middlewares/error.middleware");

router.post(
  "/presign-upload",
  authenticate,
  asyncHandler(controller.presignUpload)
);

router.get(
  "/presign-download",
  authenticate,
  asyncHandler(controller.presignDownload)
);

router.post("/", authenticate, asyncHandler(controller.createAcidente));

router.get("/", authenticate, asyncHandler(controller.getAllAcidentes));

router.get("/colaborador/:opsId", authenticate, asyncHandler(controller.getAcidentesByColaborador));

router.get("/:id", authenticate, asyncHandler(controller.getAcidenteById));

router.post("/:id/cancelar", authenticate, asyncHandler(controller.cancelarAcidente));

module.exports = router;
