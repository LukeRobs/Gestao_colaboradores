const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");

const { carregarDashboard } = require("../controllers/dashboard.controller");

router.get("/", authenticate, carregarDashboard);

module.exports = router;
