const { createLogger } = require("../utils/logger");
const {
  getLatestRow,
  getPendingToday,
  findRowById,
  findRowByIndex,
  claimRowForProcessing,
  markRowSent,
  markRowError,
  updateRowStatus,
} = require("../services/googleSheets.service");
const { sendText, sendImage } = require("../services/greenapi.service");
const appConfig = require("../config/appConfig");

const logger = createLogger("AutomationController");

// ─── GET /api/automation/pending-today ───────────────────────────────────────
// Returns all PENDING rows for today (IST), including rowIndex.
// n8n uses rowIndex — not id — to claim/update rows.
async function getPendingTodayController(req, res) {
  try {
    const rows = await getPendingToday();

    logger.info("[pending-today] Returning pending rows", { count: rows.length });

    const result = rows.map((row) => ({
      rowIndex:         row.rowIndex,   // PRIMARY KEY for all subsequent operations
      id:               row.id,
      donationDate:     row.donationDate,
      familyName:       row.familyName,
      imageUrl:         row.imageUrl,
      formattedMessage: row.formattedMessage,
      status:           row.status,
      retryCount:       row.retryCount,
    }));

    return res.json(result);
  } catch (error) {
    logger.error("[pending-today] failed", { error: error.message });
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

// ─── POST /api/automation/claim-row ──────────────────────────────────────────
// Atomically transitions a row from PENDING → PROCESSING.
// Returns 409 if already claimed or sent — n8n should skip on 409.
// Body: { rowIndex: number }
async function claimRowController(req, res) {
  try {
    const rowIndex = parseInt(req.body.rowIndex, 10);

    if (!rowIndex || isNaN(rowIndex)) {
      return res.status(400).json({ success: false, error: "Missing or invalid rowIndex" });
    }

    logger.info("[claim-row] Attempting to claim row", { rowIndex });

    const result = await claimRowForProcessing(rowIndex);

    if (!result.claimed) {
      logger.warn("[claim-row] Row not claimable — skipping", { rowIndex, reason: result.reason, status: result.status });
      return res.status(409).json({
        success: false,
        claimed: false,
        reason: result.reason,
        currentStatus: result.status || null,
      });
    }

    logger.info("[claim-row] Row claimed successfully", {
      rowIndex,
      id: result.row.id,
      familyName: result.row.familyName,
    });

    return res.json({
      success: true,
      claimed: true,
      rowIndex,
      id: result.row.id,
      familyName: result.row.familyName,
      imageUrl: result.row.imageUrl,
      formattedMessage: result.row.formattedMessage,
    });
  } catch (error) {
    logger.error("[claim-row] failed", { error: error.message });
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

// ─── Helper: resolve rowIndex from either payload format ─────────────────────
// Accepts { rowIndex } (new) or { id } (legacy n8n workflows).
// Returns the integer rowIndex, or null if it cannot be resolved.
async function resolveRowIndex(body) {
  // Preferred: explicit rowIndex
  const ri = parseInt(body.rowIndex, 10);
  if (!isNaN(ri) && ri > 0) {
    return ri;
  }

  // Legacy fallback: look up by id
  const id = String(body.id || "").trim();
  if (!id) return null;

  logger.info("[resolveRowIndex] Falling back to id lookup", { id });
  const row = await findRowById(id);
  if (!row) {
    logger.warn("[resolveRowIndex] No row found for id", { id });
    return null;
  }

  logger.info("[resolveRowIndex] Resolved via id", { id, rowIndex: row.rowIndex, status: row.status });
  return row.rowIndex;
}

// ─── POST /api/automation/mark-sent ──────────────────────────────────────────
// Accepts: { rowIndex: number }  — preferred
//      OR: { id: string }        — legacy (n8n workflows imported before v3)
async function markSentController(req, res) {
  try {
    logger.info("[mark-sent] Received payload", { body: req.body });

    const rowIndex = await resolveRowIndex(req.body);

    if (!rowIndex) {
      logger.error("[mark-sent] Cannot resolve row — neither rowIndex nor id provided/found", { body: req.body });
      return res.status(400).json({ success: false, error: "Provide rowIndex or a valid id" });
    }

    logger.info("[mark-sent] Resolved rowIndex", { rowIndex });

    const result = await markRowSent(rowIndex);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.reason });
    }

    logger.info("[mark-sent] Row marked SENT", { rowIndex, reason: result.reason || "updated" });
    return res.json({ success: true, rowIndex, status: "SENT" });
  } catch (error) {
    logger.error("[mark-sent] failed", { error: error.message });
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

// ─── POST /api/automation/mark-error ─────────────────────────────────────────
// Accepts: { rowIndex: number, errorMessage: string }  — preferred
//      OR: { id: string,       errorMessage: string }  — legacy
async function markErrorController(req, res) {
  try {
    const errorMessage = String(req.body.errorMessage || "Unknown error");
    logger.warn("[mark-error] Received payload", { body: { ...req.body, errorMessage } });

    const rowIndex = await resolveRowIndex(req.body);

    if (!rowIndex) {
      logger.error("[mark-error] Cannot resolve row — neither rowIndex nor id provided/found", { body: req.body });
      return res.status(400).json({ success: false, error: "Provide rowIndex or a valid id" });
    }

    logger.warn("[mark-error] Resolved rowIndex", { rowIndex, errorMessage });

    const result = await markRowError(rowIndex, errorMessage);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.reason });
    }

    logger.info("[mark-error] Row returned to PENDING for retry", { rowIndex, retryCount: result.retryCount });
    return res.json({ success: true, rowIndex, status: "PENDING", retryCount: result.retryCount });
  } catch (error) {
    logger.error("[mark-error] failed", { error: error.message });
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

// ─── POST /api/automation/send-whatsapp ──────────────────────────────────────
// Sends a WhatsApp message directly via GreenAPI.
// n8n calls this after claiming a row.
// Body: { chatId, message, imageUrl }
async function sendWhatsAppMessageController(req, res) {
  try {
    const { chatId, message, imageUrl } = req.body;

    logger.info("[send-whatsapp] Sending message", {
      chatId,
      hasImage: !!imageUrl,
      preview: message?.substring(0, 60),
    });

    if (!chatId || !message) {
      return res.status(400).json({ success: false, error: "Missing required fields: chatId and message" });
    }

    const result = imageUrl
      ? await sendImage(chatId, imageUrl, message)
      : await sendText(chatId, message);

    if (!result.success) {
      logger.warn("[send-whatsapp] GreenAPI send failed", { error: result.error });
      return res.status(502).json({ success: false, error: result.error });
    }

    logger.info("[send-whatsapp] Message sent successfully", { idMessage: result.data?.idMessage });
    return res.json({ success: true, idMessage: result.data?.idMessage });
  } catch (error) {
    logger.error("[send-whatsapp] failed", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ─── Legacy endpoints (kept for backward compatibility) ───────────────────────

async function getLatestRowController(req, res) {
  try {
    const row = await getLatestRow();
    logger.info("[latest-row] fetched", { id: row.id, status: row.status });
    return res.json({ success: true, data: row });
  } catch (error) {
    logger.error("[latest-row] failed", { error: error.message });
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

async function sendDailyAnnouncementController(req, res) {
  return res.status(410).json({
    success: false,
    error: "This endpoint is deprecated. Use /pending-today + /claim-row + /send-whatsapp + /mark-sent workflow instead.",
  });
}

module.exports = {
  getPendingTodayController,
  claimRowController,
  markSentController,
  markErrorController,
  sendWhatsAppMessageController,
  getLatestRowController,
  sendDailyAnnouncementController,
};
