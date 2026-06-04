const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  getPendingTodayController,
  claimRowController,
  markSentController,
  markErrorController,
  sendWhatsAppMessageController,
  getLatestRowController,
  sendDailyAnnouncementController,
} = require("../controllers/automation.controller");

const router = express.Router();

// ── Primary automation endpoints (used by n8n) ────────────────────────────────
router.get("/pending-today",            asyncHandler(getPendingTodayController));
router.post("/claim-row",               asyncHandler(claimRowController));
router.post("/mark-sent",               asyncHandler(markSentController));
router.post("/mark-error",              asyncHandler(markErrorController));
router.post("/send-whatsapp",           asyncHandler(sendWhatsAppMessageController));

// ── Legacy / debug ────────────────────────────────────────────────────────────
router.get("/latest-row",               asyncHandler(getLatestRowController));
router.post("/send-daily-announcement", asyncHandler(sendDailyAnnouncementController));

module.exports = router;
