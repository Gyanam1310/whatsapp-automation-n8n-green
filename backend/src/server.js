require("dotenv").config({ path: __dirname + "/../.env" });

const app = require("./app");
const env = require("./config/env");
const appConfig = require("./config/appConfig");
const { createLogger } = require("./utils/logger");

const logger = createLogger("Server");
const PORT = env.PORT;

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info("Server listening", { port: PORT, env: appConfig.nodeEnv });

  // Startup env check — confirms Docker env vars are loaded correctly
  logger.info("Env check", {
    NODE_ENV: process.env.NODE_ENV || "(not set)",
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      ? `set (${process.env.GOOGLE_SHEETS_SPREADSHEET_ID.slice(0, 8)}...)`
      : "NOT SET ⚠️",
    GOOGLE_DRIVE_ROOT_FOLDER_ID: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
      ? `set (${process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID.slice(0, 8)}...)`
      : "NOT SET ⚠️",
    GREENAPI_INSTANCE_ID: process.env.GREENAPI_INSTANCE_ID
      ? "set"
      : "NOT SET ⚠️",
  });

  logger.info("Available endpoints", {
    health: "/health",
    webhooks: "/api/webhooks",
    drive: "/drive",
    submit: "/submit",
    pendingToday: "/api/automation/pending-today",
    markSent: "/api/automation/mark-sent",
  });
});

process.on("uncaughtException", (error) => {
  logger.error("uncaughtException", { message: error.message, stack: error.stack });
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { reason: String(reason) });
});
