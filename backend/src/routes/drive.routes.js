const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  debugDrive,
  listFolders,
  listImages,
  streamImage,
} = require("../controllers/drive.controller");

const router = express.Router();

router.get("/debug", asyncHandler(debugDrive));
router.get("/folders", asyncHandler(listFolders));
router.get("/files/:folderId", asyncHandler(listImages));
router.get("/image/:fileId", asyncHandler(streamImage));

module.exports = router;
