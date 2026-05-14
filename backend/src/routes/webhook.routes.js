const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { handleWebhook, healthCheck } = require("../controllers/webhook.controller");

const router = express.Router();

router.post("/whatsapp", asyncHandler(handleWebhook));
router.get("/health", asyncHandler(healthCheck));

module.exports = router;
