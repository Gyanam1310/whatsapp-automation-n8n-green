const { randomUUID } = require("crypto");
const { submissionSchema } = require("../validators/submission.validator");
const { appendSubmissionToSheet } = require("../services/googleSheets.service");
const { buildPublicDriveUrl } = require("../utils/urlHelpers");
const { createLogger } = require("../utils/logger");

const logger = createLogger("SubmissionController");

function buildDriveImageUrl(fileId) {
  if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
    throw new Error("INVALID_FILE_ID");
  }

  // Convert to public Google Drive URL that is accessible externally by GreenAPI
  // Format: https://drive.google.com/uc?export=view&id=FILE_ID
  return buildPublicDriveUrl(fileId);
}

function buildSheetRecord(parsed) {
  const now = new Date();

  return {
    id: randomUUID(),
    createdAt: now,
    donationDate: parsed.scheduledDate,
    familyName: String(parsed.inputData?.familyName || "").trim(),
    imageUrl: buildDriveImageUrl(parsed.fileId),
    formattedMessage: parsed.message,
    status: "PENDING",
    retryCount: 0,
    sentAt: "",
    errorMessage: "",
  };
}

async function submitAnnouncement(req, res) {
  try {
    const parsed = submissionSchema.parse(req.body);
    const safeDate = new Date(parsed.scheduledDate);

    if (Number.isNaN(safeDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    const sheetRow = buildSheetRecord(parsed);
    sheetRow.donationDate = safeDate;

    logger.info("Submission received", { submissionId: sheetRow.id, family: sheetRow.familyName });

    const sheetResult = await appendSubmissionToSheet(sheetRow);

    logger.info("Submission appended to Google Sheets", {
      submissionId: sheetRow.id,
      sheetId: sheetResult?.sheetId,
    });

    return res.json({
      success: true,
      submissionId: sheetRow.id,
      message: "Submission received and logged to Google Sheets",
    });
  } catch (error) {
    logger.error("Submission handler error", { error: error.message });

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Invalid submission data",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  submitAnnouncement,
};
