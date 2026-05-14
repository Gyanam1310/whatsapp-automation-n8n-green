// API base URL — empty string means all paths are relative to window.location.origin.
// nginx proxies /drive/*, /submit, /api/* to the backend container.
// This works for both Docker (port 80 via nginx) and direct backend (port 5000).
const API_BASE_URL = "";

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);

  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
    });

    if (!response.ok) {
      const error = new Error(`API request failed with status ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return response;
  } catch (error) {
    console.error(`[API] Request failed: ${url}`, error);

    if (error instanceof Error && error.message.startsWith("API request failed")) {
      throw error;
    }

    throw new Error("Backend not reachable");
  }
}
