const express = require("express");
const router = express.Router();
const { authorize } = require("../middlewares/auth.middleware");
const { asyncHandler } = require("../middlewares/error.middleware");

const {
  listarRegionais,
  criarRegional,
  atualizarRegional,
  excluirRegional,
} = require("../controllers/regional.controller");

router.get("/", asyncHandler(listarRegionais));
router.post("/", authorize("ADMIN", "ALTA_GESTAO"), asyncHandler(criarRegional));
router.put("/:idRegional", authorize("ADMIN", "ALTA_GESTAO"), asyncHandler(atualizarRegional));
router.delete("/:idRegional", authorize("ADMIN", "ALTA_GESTAO"), asyncHandler(excluirRegional));

module.exports = router;
