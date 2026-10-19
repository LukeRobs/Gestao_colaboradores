const express = require("express");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const spxIngestAuth = require("../middlewares/spxIngestAuth.middleware");
const ctrl = require("../controllers/spxIngest.controller");

const router = express.Router();

// Rota pública (as máquinas do Tampermonkey não têm login): só passa com o token. O limite é folgado porque
// várias máquinas podem sair pelo mesmo IP da empresa, mas barra tentativa de adivinhar o token em massa.
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 600,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ ok: false, error: "Limite de requisições excedido" }),
  })
);
router.use(spxIngestAuth);

router.post("/transbordo-cd", ctrl.receberTransbordo);
router.post("/trip-list", ctrl.receberTripList);
router.post("/trip-history", ctrl.receberTripHistory);
router.post("/queue-list", ctrl.receberQueueList);
router.post("/stage-in", ctrl.receberStageIn);
router.get("/trip-list", ctrl.lerTripList);
router.get("/trip-history", ctrl.lerTripHistory);

module.exports = router;
