const express = require("express");
const router = express.Router();
const { authorize } = require("../middlewares/auth.middleware");

/* =====================================================
   CONTROLLER
===================================================== */
const {
  carregarDashboardAdmin,
} = require("../controllers/dashboardAdmin.controller");
router.get("/", authorize("ADMIN", "ALTA_GESTAO"), carregarDashboardAdmin);

module.exports = router;
