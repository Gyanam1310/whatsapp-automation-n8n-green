/**
 * URL helper utilities for Google Drive integration
 * Converts file IDs to publicly accessible Google Drive URLs
 * that can be used by external services like GreenAPI
 */

function buildPublicDriveUrl(fileId) {
  if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
    throw new Error('INVALID_FILE_ID');
  }

  const cleanFileId = fileId.trim();
  // Direct Google Drive public URL format
  // Works with external services like GreenAPI's SendFileByUrl endpoint
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(cleanFileId)}`;
}

function validateDriveFileId(fileId) {
  return typeof fileId === 'string' && fileId.trim().length > 0;
}

function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Handle format: https://drive.google.com/file/d/FILE_ID/view
  const viewMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (viewMatch) {
    return viewMatch[1];
  }

  // Handle format: https://drive.google.com/uc?export=view&id=FILE_ID
  const ucMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (ucMatch) {
    return ucMatch[1];
  }

  return null;
}

module.exports = {
  buildPublicDriveUrl,
  validateDriveFileId,
  extractDriveFileId,
};
