const express = require("express");
const router = express.Router();

const exportController = require("../controllers/exportColaboradores.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

/* STATUS DA EXPORTAÇÃO (última/próxima execução) */
router.get("/status", authenticate, exportController.getStatus);

/* DISPARAR EXPORTAÇÃO MANUAL — apenas ADMIN */
router.post("/agora", authenticate, authorize("ADMIN"), exportController.exportarAgora);

module.exports = router;
