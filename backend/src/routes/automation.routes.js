const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  getLatestRowController,
  sendWhatsAppMessageController,
  sendDailyAnnouncementController,
  getPendingTodayController,
  markSentController,
} = require("../controllers/automation.controller");

const router = express.Router();

router.get("/latest-row", asyncHandler(getLatestRowController));
router.post("/send-whatsapp", asyncHandler(sendWhatsAppMessageController));
router.post("/send-daily-announcement", asyncHandler(sendDailyAnnouncementController));
router.get("/pending-today", asyncHandler(getPendingTodayController));
router.post("/mark-sent", asyncHandler(markSentController));

module.exports = router;
