const express = require("express");
const router = express.Router();
const { listarDocas, obterDoca, alocarDoca, liberarDoca, adicionarPessoaNaDoca } = require("../controllers/docas.controller");
const { adminAltaGestaoLideranca } = require("../utils/roles");
const onlyEstacao = require("../middlewares/onlyEstacao");

// Exclusivo estação 1 (Jaboatão) — mesma restrição do Mapa Operacional
router.use(adminAltaGestaoLideranca, onlyEstacao([1]));

router.get("/", listarDocas);
router.get("/:numero", obterDoca);
router.post("/:numero/alocar", alocarDoca);
router.delete("/:numero/alocar", liberarDoca);
router.post("/:numero/pessoas", adicionarPessoaNaDoca);

module.exports = router;
