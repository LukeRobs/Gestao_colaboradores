const express = require("express");
const router = express.Router();

const controller = require("../controllers/medidaDisciplinar.controller");

// Presigned URLs
router.post("/presign-upload", controller.presignUpload);
router.get("/:id/presign-download", controller.presignDownload);

// CRUD
router.post("/", controller.createMedida);
router.get("/", controller.getAllMedidas);
router.get("/:id", controller.getMedidaById);

module.exports = router;
