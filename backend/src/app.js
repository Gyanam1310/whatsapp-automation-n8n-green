const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const appConfig = require("./config/appConfig");
const { createLogger } = require("./utils/logger");

const submissionRoutes = require("./routes/submission.routes");
const driveRoutes = require("./routes/drive.routes");
const webhookRoutes = require("./routes/webhook.routes");
const automationRoutes = require("./routes/automation.routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const frontendPath = path.join(__dirname, "../../frontend");
const logger = createLogger("App");
const allowedOrigins = appConfig.corsOrigins;

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: null,
      },
    },
  }),
);

const corsOptions = {
  // Allow any origin — the backend is only reachable through nginx,
  // which is the actual security boundary. This ensures Cloudflare Tunnel
  // hostnames and any other reverse-proxy setups work without reconfiguration.
  origin: true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.get("/debug/config", (req, res) => {
  if (appConfig.isProduction) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }

  logger.debug("Debug config endpoint requested");
  return res.status(200).json({
    success: true,
    config: {
      nodeEnv: appConfig.nodeEnv,
      port: appConfig.port,
      apiBaseUrl: appConfig.apiBaseUrl,
      corsOrigins: appConfig.corsOrigins,
      driveRootConfigured: Boolean(appConfig.drive.rootFolderId),
      sheetsConfigured: Boolean(appConfig.sheets.spreadsheetId),
      greenapiconfigured: Boolean(appConfig.greenapi.instanceId),
    },
  });
});

app.use("/api/webhooks", webhookRoutes);
app.use("/api/automation", automationRoutes);
app.use("/drive", driveRoutes);
app.use(express.static(frontendPath));
app.use("/", submissionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

