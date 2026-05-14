const { google } = require("googleapis");
const {
  SERVICE_ACCOUNT_PATH,
  hasServiceAccountFile,
  createGoogleAuth,
} = require("./googleServiceAccount");
const appConfig = require("../config/appConfig");
const { createLogger } = require("../utils/logger");

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
const sheets = google.sheets({
  version: "v4",
  auth,
});

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

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function toIsoDateOnly(value) {
  const safe = toSafeString(value);
  if (!safe) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
    return safe;
  }

  const parsed = new Date(safe);
  if (Number.isNaN(parsed.getTime())) {
    return safe;
  }

  return parsed.toISOString();
}

function normalizeStatus(status) {
  const value = toSafeString(status).toUpperCase();
  return value || "PENDING";
}

function normalizeRetryCount(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
}

function isHeaderRow(row) {
  return String(row?.[0] || "").trim().toLowerCase() === "id";
}

async function getNextSheetId() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB_NAME}!A:A`,
    majorDimension: "ROWS",
  });

  const rows = Array.isArray(response?.data?.values) ? response.data.values : [];
  if (rows.length === 0) {
    return 1;
  }

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
      requestBody: {
        values: [row],
      },
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
  if (rows.length === 0) {
    throw new Error("No rows found in sheet");
  }

  const hasHeader = isHeaderRow(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length === 0) {
    throw new Error("No data rows found in sheet (only header)");
  }

  const latestRow = dataRows[dataRows.length - 1];
  return {
    id: latestRow[0] || "",
    createdAt: latestRow[1] || "",
    donationDate: latestRow[2] || "",
    familyName: latestRow[3] || "",
    imageUrl: latestRow[4] || "",
    formattedMessage: latestRow[5] || "",
    status: latestRow[6] || "PENDING",
    retryCount: latestRow[7] || "0",
    sentAt: latestRow[8] || "",
    errorMessage: latestRow[9] || "",
    rowIndex: (hasHeader ? dataRows.length : dataRows.length - 1) + (hasHeader ? 1 : 0),
  };
}

async function updateRowStatus(rowIndex, updates) {
  assertSheetsConfigured();

  // Build value ranges using A1 notation.
  // Column mapping (1-based): G=status(7), I=sentAt(9), J=errorMessage(10)
  const data = [];

  if (updates.status !== undefined) {
    data.push({
      range: `${SHEET_TAB_NAME}!G${rowIndex}`,
      values: [[normalizeStatus(updates.status)]],
    });
  }

  if (updates.sentAt !== undefined) {
    data.push({
      range: `${SHEET_TAB_NAME}!I${rowIndex}`,
      values: [[toSafeString(updates.sentAt)]],
    });
  }

  if (updates.errorMessage !== undefined) {
    data.push({
      range: `${SHEET_TAB_NAME}!J${rowIndex}`,
      values: [[toSafeString(updates.errorMessage)]],
    });
  }

  if (data.length === 0) {
    logger.warn("updateRowStatus called with no updates");
    return { success: true, message: "No updates to apply" };
  }

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });

    logger.info("Row status updated", { rowIndex, updates });
    return { success: true, rowIndex, updates };
  } catch (error) {
    logger.error("Failed to update row status", { rowIndex, error: error.message });
    error.statusCode = error.statusCode || 502;
    throw error;
  }
}

// Returns today's date as YYYY-MM-DD in India timezone (IST = UTC+5:30)
function getTodayIST() {
  const now = new Date();
  // Offset IST: UTC+5:30 = 330 minutes
  const istOffset = 330 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  return istNow.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Normalise a donationDate cell value to "YYYY-MM-DD" for comparison
function normalizeDonationDate(value) {
  const safe = toSafeString(value);
  if (!safe) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  // ISO datetime string — take date part
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);
  // Try generic parse
  const parsed = new Date(safe);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return safe;
}

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
    id: row[0] || "",
    createdAt: row[1] || "",
    donationDate: row[2] || "",
    familyName: row[3] || "",
    imageUrl: row[4] || "",
    formattedMessage: row[5] || "",
    status: normalizeStatus(row[6]),
    retryCount: row[7] || "0",
    sentAt: row[8] || "",
    errorMessage: row[9] || "",
    // 1-based sheet row; +1 for header if present, +1 for 1-based index
    rowIndex: index + (hasHeader ? 2 : 1),
  }));
}

async function getPendingToday() {
  const today = getTodayIST();
  logger.debug("Fetching pending rows for today", { today });

  const allRows = await getAllRows();

  const pending = allRows.filter((row) => {
    const rowDate = normalizeDonationDate(row.donationDate);
    return rowDate === today && row.status === "PENDING";
  });

  logger.info("Pending rows for today", { count: pending.length, today });
  return pending;
}

// Find a row by its id column value and return it with its rowIndex
async function findRowById(id) {
  const allRows = await getAllRows();
  return allRows.find((row) => String(row.id) === String(id)) || null;
}

module.exports = {
  appendSubmissionToSheet,
  buildSheetRow,
  getNextSheetId,
  getLatestRow,
  updateRowStatus,
  getPendingToday,
  findRowById,
  SHEET_TAB_NAME,
  SPREADSHEET_ID,
  SHEET_COLUMNS,
};