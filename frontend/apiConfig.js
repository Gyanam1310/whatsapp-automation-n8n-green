// All API requests use relative paths so the app works identically on:
//   - localhost (direct Docker)
//   - Cloudflare Tunnel
//   - any other reverse proxy
//
// nginx routes:
//   /drive/*   → backend:5000
//   /submit    → backend:5000
//   /api/*     → backend:5000
//   everything else → frontend container

export function getApiBaseUrl() {
  return "";
}

// Returns a root-relative path. Absolute URLs (e.g. data: URIs) pass through unchanged.
export function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path) || /^data:/i.test(path)) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);

  try {
    const response = await fetch(url, {
      // No credentials: "include" — we don't use cookies.
      // Omitting it avoids preflight CORS issues through tunnels/proxies.
      ...options,
    });

    if (!response.ok) {
      // Temporary: log full response details to help diagnose tunnel issues.
      console.error(`[API] ${options.method || "GET"} ${url} → ${response.status} ${response.statusText}`);
      const error = new Error(`API request failed with status ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("API request failed")) {
      throw error;
    }

    // Temporary: log network-level failures.
    console.error(`[API] Network error: ${options.method || "GET"} ${url}`, error.message);
    throw new Error("Backend not reachable");
  }
}
