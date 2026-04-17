const express = require("express");
const router = express.Router();
const controller = require("../controllers/medidaDisciplinar.controller");

/* =====================================================
   PRESIGNED URLS
===================================================== */

// gerar URL para upload da carta assinada
router.get("/:id/presign-upload", controller.presignUpload);

// gerar URL para download da carta assinada (após finalização)
router.get("/:id/presign-download", controller.presignDownload);

/* =====================================================
   FINALIZAR MEDIDA (SALVAR PDF)
===================================================== */

router.post("/:id/finalizar", controller.finalizarMedida);

/* =====================================================
   ENVIAR EVIDÊNCIA POR E-MAIL
===================================================== */

router.post("/:id/enviar-email", controller.enviarEmailEvidencia);

/* =====================================================
   CRUD
===================================================== */

router.post("/", controller.createMedida);
router.get("/", controller.getAllMedidas);
router.get("/:id", controller.getMedidaById);

module.exports = router;