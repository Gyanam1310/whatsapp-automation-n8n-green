const appConfig = require("../config/appConfig");
const { createLogger } = require("../utils/logger");
const axios = require("axios");

const logger = createLogger("WebhookService");

async function forwardToN8n(payload) {
  if (!appConfig.n8n.webhookUrl) {
    logger.debug("n8n webhook not configured, skipping forward");
    return { success: true, message: "n8n webhook not configured" };
  }

  try {
    logger.debug("Forwarding webhook payload to n8n", {
      url: appConfig.n8n.webhookUrl,
      hasPayload: !!payload,
    });

    const response = await axios.post(appConfig.n8n.webhookUrl, payload, {
      timeout: 5000,
    });

    logger.info("Successfully forwarded to n8n", { status: response.status });
    return { success: true, data: response.data };
  } catch (error) {
    logger.warn("Failed to forward to n8n", {
      error: error.message,
      status: error.response?.status,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

function parseWebhookPayload(body) {
  if (!body) {
    return null;
  }

  try {
    if (body.typeWebhook === "incomingMessageReceived") {
      return {
        type: "message",
        from: body.senderData?.senderName || body.senderContactJid,
        message: body.messageData?.textMessageData?.textMessage || body.messageData?.extendedTextMessageData?.text,
        timestamp: body.timestamp,
        raw: body,
      };
    }

    if (body.typeWebhook === "incoming_message_ack") {
      return {
        type: "ack",
        idMessage: body.idMessage,
        ackType: body.ackType,
        timestamp: body.timestamp,
        raw: body,
      };
    }

    return {
      type: "unknown",
      raw: body,
    };
  } catch (error) {
    logger.error("Failed to parse webhook payload", { error: error.message });
    return null;
  }
}

function validateWebhook(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, reason: "Invalid body" };
  }

  if (!body.typeWebhook) {
    return { valid: false, reason: "Missing typeWebhook" };
  }

  return { valid: true };
}

module.exports = {
  forwardToN8n,
  parseWebhookPayload,
  validateWebhook,
};
