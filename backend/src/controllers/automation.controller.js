const { createLogger } = require("../utils/logger");
const {
  getLatestRow,
  updateRowStatus,
  getPendingToday,
  findRowById,
} = require("../services/googleSheets.service");
const { sendText, sendImage } = require("../services/greenapi.service");
const appConfig = require("../config/appConfig");

const logger = createLogger("AutomationController");

async function getLatestRowController(req, res, next) {
  try {
    logger.debug("Fetching latest row");

    const row = await getLatestRow();

    logger.info("Latest row fetched", {
      id: row.id,
      familyName: row.familyName,
      status: row.status,
    });

    return res.json({
      success: true,
      data: row,
    });
  } catch (error) {
    logger.error("Failed to fetch latest row", { error: error.message });
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
}

async function sendWhatsAppMessageController(req, res, next) {
  try {
    const { chatId, message, imageUrl } = req.body;

    logger.info("Sending WhatsApp message", {
      chatId,
      messagePreview: message?.substring(0, 50),
      hasImage: !!imageUrl,
    });

    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chatId and message",
      });
    }

    let result;
    if (imageUrl) {
      logger.debug("Sending message with image", { imageUrl });
      result = await sendImage(chatId, imageUrl, message);
    } else {
      logger.debug("Sending text message only");
      result = await sendText(chatId, message);
    }

    if (!result.success) {
      logger.warn("Failed to send message via GreenAPI", { error: result.error });
      return res.status(502).json({
        success: false,
        error: result.error,
      });
    }

    const idMessage = result.data?.idMessage;

    logger.info("Message sent successfully", { idMessage });

    return res.json({
      success: true,
      idMessage,
      message: "Message sent to WhatsApp group",
    });
  } catch (error) {
    logger.error("WhatsApp send error", { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async function sendDailyAnnouncementController(req, res, next) {
  try {
    logger.info("Starting daily announcement workflow");

    const latestRow = await getLatestRow();

    if (!latestRow) {
      logger.warn("No rows found to send");
      return res.status(400).json({
        success: false,
        error: "No rows found in sheet",
      });
    }

    logger.debug("Latest row retrieved", {
      id: latestRow.id,
      familyName: latestRow.familyName,
    });

    if (latestRow.status === "SENT") {
      logger.info("Latest row already sent, skipping", { id: latestRow.id });
      return res.status(400).json({
        success: false,
        error: "Latest row already sent",
      });
    }

    const message = latestRow.formattedMessage;
    const imageUrl = latestRow.imageUrl;
    const chatId = appConfig.whatsapp.groupId;

    if (!message) {
      logger.error("No message in latest row");
      return res.status(400).json({
        success: false,
        error: "No formatted message in sheet",
      });
    }

    let sendResult;
    if (imageUrl) {
      logger.debug("Sending announcement with image");
      sendResult = await sendImage(chatId, imageUrl, message);
    } else {
      logger.debug("Sending announcement as text");
      sendResult = await sendText(chatId, message);
    }

    if (!sendResult.success) {
      logger.error("Failed to send announcement", { error: sendResult.error });

      await updateRowStatus(latestRow.rowIndex, {
        status: "ERROR",
        errorMessage: String(sendResult.error?.message || sendResult.error),
      }).catch((err) => {
        logger.error("Failed to update error status", { error: err.message });
      });

      return res.status(502).json({
        success: false,
        error: sendResult.error,
      });
    }

    logger.info("Announcement sent, updating sheet status", {
      id: latestRow.id,
      idMessage: sendResult.data?.idMessage,
    });

    await updateRowStatus(latestRow.rowIndex, {
      status: "SENT",
      sentAt: new Date().toISOString(),
    });

    logger.info("Daily announcement completed successfully", {
      submissionId: latestRow.id,
      family: latestRow.familyName,
    });

    return res.json({
      success: true,
      submissionId: latestRow.id,
      idMessage: sendResult.data?.idMessage,
      message: "Daily announcement sent successfully",
    });
  } catch (error) {
    logger.error("Daily announcement error", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async function getPendingTodayController(req, res) {
  try {
    const rows = await getPendingToday();

    const result = rows.map((row) => ({
      id: row.id,
      donationDate: row.donationDate,
      familyName: row.familyName,
      imageUrl: row.imageUrl,
      formattedMessage: row.formattedMessage,
      status: row.status,
    }));

    return res.json(result);
  } catch (error) {
    logger.error("getPendingToday failed", { error: error.message });
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
}

async function markSentController(req, res) {
  try {
    const { id } = req.body;

    if (!id && id !== 0) {
      return res.status(400).json({ success: false, error: "Missing required field: id" });
    }

    const row = await findRowById(id);

    if (!row) {
      return res.status(404).json({ success: false, error: `Row with id ${id} not found` });
    }

    await updateRowStatus(row.rowIndex, {
      status: "SENT",
      sentAt: new Date().toISOString(),
      errorMessage: "",
    });

    logger.info("Row marked as SENT", { id, rowIndex: row.rowIndex });

    return res.json({ success: true, id, status: "SENT" });
  } catch (error) {
    logger.error("markSent failed", { error: error.message });
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  getLatestRowController,
  sendWhatsAppMessageController,
  sendDailyAnnouncementController,
  getPendingTodayController,
  markSentController,
};
