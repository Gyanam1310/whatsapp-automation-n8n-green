const { z } = require("zod");
const { drive, getFolders, getImages, checkAuth } = require("../services/googleDrive.service");
const { createLogger } = require("../utils/logger");

const logger = createLogger("DriveController");

const folderIdParamSchema = z.object({
  folderId: z.string().trim().min(1, "folderId is required"),
});

async function debugDrive(req, res) {
  const parent = req.query.parent || undefined;

  const auth = await checkAuth();
  let sample = [];
  let sampleError = null;

  try {
    sample = await getFolders(parent);
  } catch (error) {
    sampleError = error.message;
    logger.warn("Drive debug sample fetch failed", { error: error.message });
  }

  return res.json({
    success: true,
    auth,
    parent: parent || null,
    foldersReturned: Array.isArray(sample) ? sample.length : null,
    sample: Array.isArray(sample) ? sample.slice(0, 10) : [],
    sampleError,
  });
}

async function listFolders(req, res) {
  const folders = await getFolders();

  return res.status(200).json({
    success: true,
    folders,
    data: folders,
  });
}

async function listImages(req, res) {
  const parsed = folderIdParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const images = await getImages(parsed.data.folderId);

  return res.status(200).json({
    success: true,
    data: images,
  });
}

async function streamImage(req, res) {
  try {
    const response = await drive.files.get(
      {
        fileId: req.params.fileId,
        alt: "media",
      },
      { responseType: "stream" },
    );

    res.setHeader("Content-Type", response.headers["content-type"] || "image/jpeg");
    response.data.pipe(res);
  } catch (error) {
    logger.error("Image fetch failed", { error: error.message, fileId: req.params.fileId });
    return res.status(500).json({ success: false, message: "Image load failed" });
  }

  return undefined;
}

module.exports = {
  debugDrive,
  listFolders,
  listImages,
  streamImage,
};
