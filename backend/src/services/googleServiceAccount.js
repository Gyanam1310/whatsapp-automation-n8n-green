const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../../service-account.json");

function hasServiceAccountFile() {
  return fs.existsSync(SERVICE_ACCOUNT_PATH);
}

function logMissingServiceAccount(scopeLabel) {
  if (!hasServiceAccountFile()) {
    console.error(
      `[${scopeLabel}] service-account.json not found at: ${SERVICE_ACCOUNT_PATH}. ${scopeLabel} requests will return a 503 until credentials are added.`,
    );
  }
}

function createGoogleAuth(scopes, scopeLabel = "Google") {
  logMissingServiceAccount(scopeLabel);

  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes,
  });

  // attach a helper to verify the auth can produce an access token
  auth.verify = async function verify() {
    if (!hasServiceAccountFile()) {
      throw new Error("service-account.json not found");
    }

    try {
      const client = await auth.getClient();
      // try to obtain an access token
      const token = await client.getAccessToken();
      return { ok: true, token: token?.token || null };
    } catch (error) {
      throw new Error(`auth.verify failed: ${error.message}`);
    }
  };

  return auth;
}

module.exports = {
  SERVICE_ACCOUNT_PATH,
  hasServiceAccountFile,
  logMissingServiceAccount,
  createGoogleAuth,
};