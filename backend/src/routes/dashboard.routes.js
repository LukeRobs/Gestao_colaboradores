const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { withCache, TTL } = require("../middlewares/cache.middleware");

const { carregarDashboard } = require("../controllers/dashboard.controller");

router.get("/", authenticate, withCache("dashboard", TTL.OPERATIONAL), carregarDashboard);

module.exports = router;
