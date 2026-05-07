const express = require("express");
const router = express.Router();
const { authorize } = require("../middlewares/auth.middleware");
const { withCache, TTL } = require("../middlewares/cache.middleware");

/* =====================================================
   CONTROLLER
===================================================== */
const {
  carregarDashboardAdmin,
} = require("../controllers/dashboardAdmin.controller");
router.get("/", authorize("ADMIN", "ALTA_GESTAO"), withCache("dashboard-admin", TTL.ANALYTICS), carregarDashboardAdmin);

module.exports = router;
