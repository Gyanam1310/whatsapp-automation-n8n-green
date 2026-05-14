const axios = require("axios");
const appConfig = require("../config/appConfig");
const { createLogger } = require("../utils/logger");

const logger = createLogger("GreenAPIService");
const { url, instanceId, apiToken } = appConfig.greenapi;

if (!instanceId || !apiToken) {
  logger.warn("GreenAPI credentials not configured - service will not be functional");
}

const baseUrl = `${url}/waInstance${instanceId}`;
const headers = {
  "Content-Type": "application/json",
};

async function makeRequest(method, endpoint, data = null) {
  try {
    const fullUrl = `${baseUrl}/${endpoint}/apiToken/${apiToken}`;
    const config = {
      method,
      url: fullUrl,
      headers,
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    logger.error(`GreenAPI request failed: ${endpoint}`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

async function sendText(chatId, text) {
  logger.debug(`Sending text message to ${chatId}`, { preview: text.substring(0, 50) });

  const result = await makeRequest("post", "SendMessage", {
    chatId,
    message: text,
  });

  if (result.success) {
    logger.info(`Message sent to ${chatId}`, { idMessage: result.data?.idMessage });
  }

  return result;
}

async function sendImage(chatId, imageUrl, caption = "") {
  logger.debug(`Sending image to ${chatId}`, { imageUrl, caption: caption.substring(0, 50) });

  const result = await makeRequest("post", "SendFileByUrl", {
    chatId,
    urlFile: imageUrl,
    caption: caption || undefined,
  });

  if (result.success) {
    logger.info(`Image sent to ${chatId}`, { idMessage: result.data?.idMessage });
  }

  return result;
}

async function checkStatus() {
  logger.debug("Checking GreenAPI instance status");

  const result = await makeRequest("get", "GetStateInstance");

  if (result.success) {
    logger.info("GreenAPI status check successful", { state: result.data?.stateInstance });
  }

  return result;
}

async function getGroupInfo(groupId) {
  logger.debug(`Fetching group info for ${groupId}`);

  const result = await makeRequest("post", "GetGroupMetadata", {
    groupId,
  });

  if (result.success) {
    logger.info(`Group info retrieved for ${groupId}`, {
      name: result.data?.subject,
      participants: result.data?.participants?.length,
    });
  }

  return result;
}

async function getContacts() {
  logger.debug("Fetching all contacts");

  const result = await makeRequest("get", "GetContacts");

  if (result.success) {
    logger.info(`Retrieved ${result.data?.length || 0} contacts`);
  }

  return result;
}

module.exports = {
  sendText,
  sendImage,
  checkStatus,
  getGroupInfo,
  getContacts,
};
