const express = require("express");
const router = express.Router();

const {
  dashboardDesligamento,
} = require("../controllers/desligamentoDashboard.controller");

// GET /api/dashboard/desligamento
router.get("/", dashboardDesligamento);

module.exports = router;