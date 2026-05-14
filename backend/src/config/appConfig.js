const env = require("./env");

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
];

const configuredOrigins = parseCsv(env.CORS_ORIGIN);
const corsOrigins = Array.from(new Set([...configuredOrigins, ...DEV_ALLOWED_ORIGINS]));

const apiBaseUrl =
  String(env.API_BASE_URL || "").trim() ||
  `http://localhost:${env.PORT}`;

module.exports = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  isProduction: env.NODE_ENV === "production",
  corsOrigins,
  apiBaseUrl,
  drive: {
    rootFolderId: String(env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "").trim(),
  },
  sheets: {
    spreadsheetId: String(env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim(),
    tabName: String(env.GOOGLE_SHEETS_TAB_NAME || "Sheet1").trim() || "Sheet1",
  },
  greenapi: {
    url: String(env.GREENAPI_URL || "https://api.green-api.com").trim(),
    instanceId: String(env.GREENAPI_INSTANCE_ID || "").trim(),
    apiToken: String(env.GREENAPI_API_TOKEN || "").trim(),
    webhookUrl: String(env.GREENAPI_WEBHOOK_URL || "").trim(),
  },
  whatsapp: {
    groupId: String(env.WHATSAPP_GROUP_ID || "120363429056904681@g.us").trim(),
  },
  scheduler: {
    dailyCronExpression: String(env.DAILY_CRON_EXPRESSION || "0 7 * * *").trim() || "0 7 * * *",
  },
  n8n: {
    webhookUrl: String(env.N8N_WEBHOOK_URL || "").trim(),
  },
};
