const { google } = require("googleapis");
const {
  SERVICE_ACCOUNT_PATH,
  hasServiceAccountFile,
  createGoogleAuth,
} = require("./googleServiceAccount");
const appConfig = require("../config/appConfig");
const { createLogger } = require("../utils/logger");
const { randomUUID } = require("crypto");

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
const logger = createLogger("SheetsService");
const SPREADSHEET_ID = appConfig.sheets.spreadsheetId;
const SHEET_TAB_NAME = appConfig.sheets.tabName;
const SHEET_COLUMNS = [
  "id",
  "createdAt",
  "donationDate",
  "familyName",
  "imageUrl",
  "formattedMessage",
  "status",
  "retryCount",
  "sentAt",
  "errorMessage",
];

const auth = createGoogleAuth(SHEETS_SCOPE, "Sheets");
const sheets = google.sheets({ version: "v4", auth });

// ─── Assertions ───────────────────────────────────────────────────────────────

function assertSheetsConfigured() {
  if (!hasServiceAccountFile()) {
    const error = new Error(`Google Sheets credentials are missing at ${SERVICE_ACCOUNT_PATH}`);
    error.code = "SHEETS_CREDENTIALS_MISSING";
    error.statusCode = 503;
    throw error;
  }
  if (!SPREADSHEET_ID) {
    const error = new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
    error.code = "SHEETS_SPREADSHEET_ID_MISSING";
    error.statusCode = 503;
    throw error;
  }
}

// ─── Value helpers ────────────────────────────────────────────────────────────

function toSafeString(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function toIsoDateOnly(value) {
  const safe = toSafeString(value);
  if (!safe) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  const parsed = new Date(safe);
  if (Number.isNaN(parsed.getTime())) return safe;
  return parsed.toISOString();
}

// Valid status values — anything not in this list is treated as PENDING.
const VALID_STATUSES = new Set(["PENDING", "PROCESSING", "SENT", "ERROR"]);

function normalizeStatus(status) {
  const value = toSafeString(status).toUpperCase();
  return VALID_STATUSES.has(value) ? value : "PENDING";
}

function normalizeRetryCount(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
}

function isHeaderRow(row) {
  return String(row?.[0] || "").trim().toLowerCase() === "id";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

// Returns today as YYYY-MM-DD in IST (UTC+5:30).
function getTodayIST() {
  const istOffset = 330 * 60 * 1000;
  return new Date(Date.now() + istOffset).toISOString().slice(0, 10);
}

function normalizeDonationDate(value) {
  const safe = toSafeString(value);
  if (!safe) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);
  const parsed = new Date(safe);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return safe;
}

// ─── Sheet read helpers ───────────────────────────────────────────────────────

// Reads the entire sheet and returns all data rows with their 1-based rowIndex.
// rowIndex is the ONLY reliable key for updates — the id column may have duplicates.
async function getAllRows() {
  assertSheetsConfigured();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB_NAME}!A:J`,
    majorDimension: "ROWS",
  });

  const rows = Array.isArray(response?.data?.values) ? response.data.values : [];
  if (rows.length === 0) return [];

  const hasHeader = isHeaderRow(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row, index) => ({
    id:               row[0] || "",
    createdAt:        row[1] || "",
    donationDate:     row[2] || "",
    familyName:       row[3] || "",
    imageUrl:         row[4] || "",
    formattedMessage: row[5] || "",
    status:           normalizeStatus(row[6]),
    retryCount:       row[7] || "0",
    sentAt:           row[8] || "",
    errorMessage:     row[9] || "",
    // 1-based sheet row number (accounts for header row).
    rowIndex: index + (hasHeader ? 2 : 1),
  }));
}

// Find a single row by its EXACT rowIndex (most reliable — avoids duplicate-id problems).
async function findRowByIndex(rowIndex) {
  const allRows = await getAllRows();
  return allRows.find((row) => row.rowIndex === rowIndex) || null;
}

// Find by id — returns the FIRST match. Use only for legacy lookups.
async function findRowById(id) {
  const allRows = await getAllRows();
  return allRows.find((row) => String(row.id) === String(id)) || null;
}

// ─── Sheet write helpers ──────────────────────────────────────────────────────

// Updates status/retryCount/sentAt/errorMessage columns for a specific rowIndex.
// Uses A1 notation — never misidentifies the target row.
async function updateRowStatus(rowIndex, updates) {
  assertSheetsConfigured();

  const data = [];

  if (updates.status !== undefined) {
    data.push({ range: `${SHEET_TAB_NAME}!G${rowIndex}`, values: [[normalizeStatus(updates.status)]] });
  }
  if (updates.retryCount !== undefined) {
    data.push({ range: `${SHEET_TAB_NAME}!H${rowIndex}`, values: [[normalizeRetryCount(updates.retryCount)]] });
  }
  if (updates.sentAt !== undefined) {
    data.push({ range: `${SHEET_TAB_NAME}!I${rowIndex}`, values: [[toSafeString(updates.sentAt)]] });
  }
  if (updates.errorMessage !== undefined) {
    data.push({ range: `${SHEET_TAB_NAME}!J${rowIndex}`, values: [[toSafeString(updates.errorMessage)]] });
  }

  if (data.length === 0) {
    logger.warn("updateRowStatus called with no updates");
    return { success: true, message: "No updates to apply" };
  }

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "RAW", data },
    });
    logger.info("Row status updated", { rowIndex, updates });
    return { success: true, rowIndex, updates };
  } catch (error) {
    logger.error("Failed to update row status", { rowIndex, error: error.message });
    error.statusCode = error.statusCode || 502;
    throw error;
  }
}

// ─── Public queue operations ──────────────────────────────────────────────────

// Returns all rows eligible for sending today:
//   donationDate === today (IST)
//   status === PENDING  (excludes PROCESSING, SENT, ERROR)
//   retryCount < 5
//
// Returns rowIndex in the payload so n8n can target exact rows, not ids.
async function getPendingToday() {
  const today = getTodayIST();
  logger.debug("getPendingToday", { today });

  const allRows = await getAllRows();

  const pending = allRows.filter((row) => {
    const rowDate = normalizeDonationDate(row.donationDate);
    const retryCount = parseInt(row.retryCount || "0", 10);
    return (
      rowDate === today &&
      row.status === "PENDING" &&
      retryCount < 5
    );
  });

  logger.info("Pending rows for today", { count: pending.length, today });
  return pending;
}

// Atomically claim a row: PENDING → PROCESSING.
// Re-reads the row INSIDE this call to guard against race conditions.
// Returns null (with a reason) if the row cannot be claimed.
async function claimRowForProcessing(rowIndex) {
  // Re-read the current state of this specific row
  const row = await findRowByIndex(rowIndex);

  if (!row) {
    logger.warn("claimRowForProcessing: rowIndex not found", { rowIndex });
    return { claimed: false, reason: "not_found" };
  }

  if (row.status !== "PENDING") {
    logger.warn("claimRowForProcessing: row not PENDING — skipping", {
      rowIndex,
      id: row.id,
      status: row.status,
    });
    return { claimed: false, reason: "not_pending", status: row.status };
  }

  await updateRowStatus(rowIndex, { status: "PROCESSING" });
  logger.info("Row claimed for processing", { rowIndex, id: row.id, familyName: row.familyName });
  return { claimed: true, row: { ...row, status: "PROCESSING" } };
}

// Mark a row SENT — only succeeds if current status is PROCESSING.
// Accepts rowIndex directly to avoid duplicate-id ambiguity.
async function markRowSent(rowIndex) {
  const row = await findRowByIndex(rowIndex);
  if (!row) {
    logger.error("markRowSent: rowIndex not found", { rowIndex });
    return { success: false, reason: "not_found" };
  }

  if (row.status === "SENT") {
    logger.warn("markRowSent: already SENT — idempotent skip", { rowIndex, id: row.id });
    return { success: true, reason: "already_sent" };
  }

  await updateRowStatus(rowIndex, {
    status: "SENT",
    sentAt: new Date().toISOString(),
    errorMessage: "",
  });

  logger.info("Row marked SENT", { rowIndex, id: row.id, familyName: row.familyName });
  return { success: true };
}

// Mark a row back to PENDING with incremented retryCount and error message.
// Releases the PROCESSING claim so the row can be retried.
async function markRowError(rowIndex, errorMessage) {
  const row = await findRowByIndex(rowIndex);
  if (!row) {
    logger.error("markRowError: rowIndex not found", { rowIndex });
    return { success: false, reason: "not_found" };
  }

  const retryCount = parseInt(row.retryCount || "0", 10) + 1;

  await updateRowStatus(rowIndex, {
    status: "PENDING",
    retryCount,
    errorMessage: String(errorMessage || "Unknown error").slice(0, 500),
  });

  logger.warn("Row marked ERROR — returned to PENDING for retry", {
    rowIndex,
    id: row.id,
    retryCount,
    errorMessage,
  });
  return { success: true, retryCount };
}

// ─── Submission append ────────────────────────────────────────────────────────

async function getNextSheetId() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB_NAME}!A:A`,
    majorDimension: "ROWS",
  });
  const rows = Array.isArray(response?.data?.values) ? response.data.values : [];
  if (rows.length === 0) return 1;
  const hasHeader = isHeaderRow(rows[0]);
  const dataRowCount = hasHeader ? Math.max(rows.length - 1, 0) : rows.length;
  return dataRowCount + 1;
}

function buildSheetRow(operationalRecord, sheetId) {
  const row = [
    String(Number.parseInt(String(sheetId ?? 0), 10) || 0),
    toSafeString(operationalRecord.createdAt),
    toIsoDateOnly(operationalRecord.donationDate),
    toSafeString(operationalRecord.familyName),
    toSafeString(operationalRecord.imageUrl),
    toSafeString(operationalRecord.formattedMessage),
    normalizeStatus(operationalRecord.status),
    normalizeRetryCount(operationalRecord.retryCount),
    toSafeString(operationalRecord.sentAt),
    toSafeString(operationalRecord.errorMessage),
  ];
  if (row.length !== SHEET_COLUMNS.length) {
    throw new Error(`Invalid sheet row length: expected ${SHEET_COLUMNS.length}, got ${row.length}`);
  }
  return row;
}

async function appendSubmissionToSheet(operationalRecord) {
  assertSheetsConfigured();

  const sheetId = await getNextSheetId();
  const row = buildSheetRow(operationalRecord, sheetId);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB_NAME}!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    logger.info("Submission appended to sheet", { sheetId });
    return { sheetId, row };
  } catch (error) {
    logger.error("Failed to append submission", { error: error.message });
    error.statusCode = error.statusCode || 502;
    throw error;
  }
}

async function getLatestRow() {
  assertSheetsConfigured();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB_NAME}!A:J`,
    majorDimension: "ROWS",
  });

  const rows = Array.isArray(response?.data?.values) ? response.data.values : [];
  if (rows.length === 0) throw new Error("No rows found in sheet");

  const hasHeader = isHeaderRow(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) throw new Error("No data rows found in sheet (only header)");

  const latestRow = dataRows[dataRows.length - 1];
  return {
    id:               latestRow[0] || "",
    createdAt:        latestRow[1] || "",
    donationDate:     latestRow[2] || "",
    familyName:       latestRow[3] || "",
    imageUrl:         latestRow[4] || "",
    formattedMessage: latestRow[5] || "",
    status:           latestRow[6] || "PENDING",
    retryCount:       latestRow[7] || "0",
    sentAt:           latestRow[8] || "",
    errorMessage:     latestRow[9] || "",
    rowIndex: (hasHeader ? dataRows.length : dataRows.length - 1) + (hasHeader ? 1 : 0),
  };
}

module.exports = {
  appendSubmissionToSheet,
  buildSheetRow,
  getNextSheetId,
  getLatestRow,
  getAllRows,
  updateRowStatus,
  getPendingToday,
  findRowById,
  findRowByIndex,
  claimRowForProcessing,
  markRowSent,
  markRowError,
  SHEET_TAB_NAME,
  SPREADSHEET_ID,
  SHEET_COLUMNS,
};
