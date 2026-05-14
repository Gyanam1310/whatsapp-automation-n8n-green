function createHttpError(message, statusCode = 500, details) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

module.exports = {
  createHttpError,
};
