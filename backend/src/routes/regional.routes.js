const express = require("express");
const router = express.Router();

const {
  listarRegionais,
  criarRegional,
  atualizarRegional,
} = require("../controllers/regional.controller");

router.get("/", listarRegionais);
router.post("/", criarRegional);
router.put("/:idRegional", atualizarRegional);

module.exports = router;
