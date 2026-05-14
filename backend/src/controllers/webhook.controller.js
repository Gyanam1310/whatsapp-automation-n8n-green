const { createLogger } = require("../utils/logger");
const { parseWebhookPayload, validateWebhook, forwardToN8n } = require("../services/webhook.service");

const logger = createLogger("WebhookController");

async function handleWebhook(req, res, next) {
  try {
    const { body } = req;

    logger.debug("Received webhook", { typeWebhook: body?.typeWebhook });

    const validation = validateWebhook(body);
    if (!validation.valid) {
      logger.warn("Invalid webhook payload", { reason: validation.reason });
      return res.status(400).json({
        success: false,
        error: validation.reason,
      });
    }

    const parsed = parseWebhookPayload(body);
    if (!parsed) {
      logger.warn("Could not parse webhook payload");
      return res.status(400).json({
        success: false,
        error: "Could not parse webhook payload",
      });
    }

    logger.info("Webhook parsed successfully", { type: parsed.type });

    await forwardToN8n(parsed);

    return res.status(200).json({
      success: true,
      message: "Webhook received and processed",
      type: parsed.type,
    });
  } catch (error) {
    logger.error("Webhook handler error", { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async function healthCheck(req, res) {
  try {
    const { checkStatus } = require("../services/greenapi.service");
    const result = await checkStatus();

    return res.status(result.success ? 200 : 503).json({
      success: result.success,
      status: "ok",
      greenapi: result.data?.stateInstance || "unknown",
    });
  } catch (error) {
    logger.error("Health check error", { error: error.message });
    return res.status(503).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  handleWebhook,
  healthCheck,
};
