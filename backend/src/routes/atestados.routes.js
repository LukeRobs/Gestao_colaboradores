const express = require("express");
const router = express.Router();

const controller = require("../controllers/atestado.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { injectDbContext } = require("../middlewares/dbContext.middleware");
const { asyncHandler } = require("../middlewares/error.middleware");

// ================= STATS =================
router.get("/stats", authenticate, injectDbContext, asyncHandler(controller.statsAtestados));

// ================= PRESIGNED URL =================
router.post("/presign-upload", asyncHandler(controller.presignUpload));
router.get("/:id/presign-download", authenticate, asyncHandler(controller.presignDownload));

// ================= CRUD =================
router.post("/", asyncHandler(controller.createAtestado));
router.get("/", authenticate, injectDbContext, asyncHandler(controller.getAllAtestados));
router.get("/:id", authenticate, asyncHandler(controller.getAtestadoById));
router.put("/:id", authenticate, injectDbContext, asyncHandler(controller.updateAtestado));

// ================= STATUS =================
router.patch("/:id/finalizar", authenticate, injectDbContext, asyncHandler(controller.finalizarAtestado));
router.patch("/:id/cancelar", authenticate, injectDbContext, asyncHandler(controller.cancelarAtestado));

module.exports = router;
