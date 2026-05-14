const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGIN: z.string().trim().optional(),
  API_BASE_URL: z.string().trim().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().trim().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().trim().optional(),
  GOOGLE_SHEETS_TAB_NAME: z.string().trim().optional(),
  DAILY_CRON_EXPRESSION: z.string().trim().optional(),
  GREENAPI_URL: z.string().trim().optional(),
  GREENAPI_INSTANCE_ID: z.string().trim().optional(),
  GREENAPI_API_TOKEN: z.string().trim().optional(),
  GREENAPI_WEBHOOK_URL: z.string().trim().optional(),
  WHATSAPP_GROUP_ID: z.string().trim().optional(),
  N8N_WEBHOOK_URL: z.string().trim().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${messages.join("\n")}`);
}

module.exports = parsed.data;
