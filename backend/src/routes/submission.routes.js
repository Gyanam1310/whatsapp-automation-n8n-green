const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { submitAnnouncement } = require("../controllers/submission.controller");

const router = express.Router();

router.post("/submit", asyncHandler(submitAnnouncement));

module.exports = router;
