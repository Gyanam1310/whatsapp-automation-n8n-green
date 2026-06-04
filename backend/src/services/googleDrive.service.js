const { google } = require("googleapis");
const {
  SERVICE_ACCOUNT_PATH,
  hasServiceAccountFile,
  createGoogleAuth,
} = require("./googleServiceAccount");
const appConfig = require("../config/appConfig");
const { createHttpError } = require("../utils/httpError");
const { createLogger } = require("../utils/logger");

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive.readonly"];
const logger = createLogger("DriveService");

const auth = createGoogleAuth(DRIVE_SCOPE, "Drive");

const drive = google.drive({
  version: "v3",
  auth,
});

// lightweight auth check helper used for debug endpoints and logs
async function checkAuth() {
  try {
    if (typeof auth.verify === "function") {
      const result = await auth.verify();
      logger.info("Auth verify OK", { tokenPresent: Boolean(result.token) });
      return { ok: true, tokenPresent: Boolean(result.token) };
    }
    // fallback: try to get a client
    await auth.getClient();
    logger.info("Auth client acquired");
    return { ok: true, tokenPresent: null };
  } catch (error) {
    logger.error("Auth verify failed", { error: error.message });
    return { ok: false, error: String(error.message) };
  }
}

function assertDriveCredentials() {
  if (!hasServiceAccountFile()) {
    const error = new Error(`Google Drive credentials are missing at ${SERVICE_ACCOUNT_PATH}`);
    error.code = "DRIVE_CREDENTIALS_MISSING";
    error.statusCode = 503;
    throw error;
  }

  if (!appConfig.drive.rootFolderId) {
    throw createHttpError("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured", 503);
  }
}

async function getFolders(parentFolderId = appConfig.drive.rootFolderId) {
  assertDriveCredentials();

  const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  logger.info("Fetching folders", { parentFolderId });

  // verify auth before calling API for clearer errors
  const authCheck = await checkAuth();
  if (!authCheck.ok) {
    const err = new Error(`Drive auth failed: ${authCheck.error}`);
    err.statusCode = 503;
    throw err;
  }

  try {
    const start = Date.now();
    const response = await drive.files.list({
      q: query,
      // Request thumbnailLink so frontends can use lightweight thumbnails
      fields: "files(id,name,thumbnailLink,mimeType,size)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const elapsed = Date.now() - start;
    logger.info("Drive files.list elapsed_ms", { elapsedMs: elapsed, parentFolderId });

    const files = response?.data?.files || [];
    logger.info("Folders fetched", { count: files.length, parentFolderId });
    if (files.length > 0) {
      logger.debug("Folder sample", files.slice(0, 5).map((f) => ({ id: f.id, name: f.name })));
    }

    return files;
  } catch (error) {
    logger.error("Failed to fetch folders", { error: error.message, parentFolderId });
    if (error.errors) {
      logger.error("Drive API errors", error.errors);
    }
    error.statusCode = error.statusCode || 502;
    throw error;
  }
}

async function getImages(folderId) {
  assertDriveCredentials();

  const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`;
  logger.info("Fetching images", { folderId });

  const authCheck = await checkAuth();
  if (!authCheck.ok) {
    const err = new Error(`Drive auth failed: ${authCheck.error}`);
    err.statusCode = 503;
    throw err;
  }

  try {
    const start = Date.now();
    const response = await drive.files.list({
      q: query,
      // include thumbnailLink to enable lightweight previews in the frontend
      fields: "files(id,name,thumbnailLink,mimeType,size)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const elapsed = Date.now() - start;
    logger.info("Drive files.list elapsed_ms", { elapsedMs: elapsed, folderId });

    const files = response?.data?.files || [];
    logger.info("Images fetched", { count: files.length, folderId });
    if (files.length > 0) {
      logger.debug("Image sample", files.slice(0, 5).map((f) => ({ id: f.id, name: f.name, thumbnail: f.thumbnailLink || null })));
    }

    return files;
  } catch (error) {
    logger.error("Failed to fetch images", { error: error.message, folderId });
    if (error.errors) {
      logger.error("Drive API errors", error.errors);
    }
    error.statusCode = error.statusCode || 502;
    throw error;
  }
}

module.exports = {
  drive,
  getFolders,
  getImages,
  checkAuth,
};
