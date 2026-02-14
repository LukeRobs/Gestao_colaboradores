const express = require("express")
const router = express.Router()
const ReportsController = require("../controllers/reports.controller")

router.post("/email", ReportsController.sendReportByEmail)
router.post("/seatalk", ReportsController.sendReportToSeatalk)

module.exports = router
