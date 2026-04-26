const GOOGLE_MEDIA_PATH = "/__oneflash/media/google";
const GOOGLE_BROWSER_TOKEN_ENDPOINT = "/api/cloud/google/browser-token";
const GOOGLE_API_BASE = "https://www.googleapis.com/drive/v3";
const TOKEN_SKEW_MS = 5 * 1000;
const FALLBACK_TOKEN_TTL_MS = 45 * 1000;
const scopedTokenCache = new Map();

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname !== GOOGLE_MEDIA_PATH
  ) {
    return;
  }

  event.respondWith(handleGoogleMediaRequest(event.request, requestUrl));
});

function decodeScopedCloudItemId(value) {
  if (!value) {
    return null;
  }

  const separatorIndex = value.indexOf("::");
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    accountId: decodeURIComponent(value.slice(0, separatorIndex)),
    remoteId: decodeURIComponent(value.slice(separatorIndex + 2)),
  };
}

function getScopedCloudAccountId(value) {
  return decodeScopedCloudItemId(value)?.accountId || null;
}

function getScopedCloudRemoteId(value) {
  return decodeScopedCloudItemId(value)?.remoteId || value || null;
}

async function getGoogleAccessToken(accountId, forceFresh = false) {
  const cachedToken = scopedTokenCache.get(accountId);
  if (
    !forceFresh &&
    cachedToken &&
    cachedToken.accessToken &&
    cachedToken.expiresAt - Date.now() > TOKEN_SKEW_MS
  ) {
    return cachedToken.accessToken;
  }

  const response = await fetch(
    `${GOOGLE_BROWSER_TOKEN_ENDPOINT}?accountId=${encodeURIComponent(accountId)}`,
    {
      credentials: "include",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error((await response.text()) || "Failed to authorize preview request");
  }

  const payload = await response.json();
  const accessToken =
    typeof payload?.accessToken === "string" ? payload.accessToken : null;
  const expiresAt =
    typeof payload?.expiresAt === "number"
      ? payload.expiresAt
      : Date.now() + FALLBACK_TOKEN_TTL_MS;

  if (!accessToken) {
    throw new Error("Preview authorization did not return an access token");
  }

  scopedTokenCache.set(accountId, {
    accessToken,
    expiresAt,
  });

  return accessToken;
}

function buildGoogleUpstreamUrl(fileId, url) {
  const remoteFileId = getScopedCloudRemoteId(fileId);
  if (!remoteFileId) {
    return null;
  }

  const exportMimeType = url.searchParams.get("exportMimeType");
  if (exportMimeType) {
    return `${GOOGLE_API_BASE}/files/${encodeURIComponent(
      remoteFileId
    )}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
  }

  return `${GOOGLE_API_BASE}/files/${encodeURIComponent(remoteFileId)}?alt=media`;
}

async function fetchGoogleUpstream(request, upstreamUrl, accessToken) {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);

  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("Accept", accept);
  }

  const range = request.headers.get("range");
  if (range) {
    headers.set("Range", range);
  }

  return fetch(upstreamUrl, {
    headers,
    mode: "cors",
    redirect: "follow",
  });
}

function copyHeaderIfPresent(targetHeaders, upstreamHeaders, headerName) {
  const value = upstreamHeaders.get(headerName);
  if (value) {
    targetHeaders.set(headerName, value);
  }
}

async function handleGoogleMediaRequest(request, requestUrl) {
  const fileId = requestUrl.searchParams.get("fileId");
  const accountId =
    requestUrl.searchParams.get("accountId") || getScopedCloudAccountId(fileId);
  const upstreamUrl = fileId ? buildGoogleUpstreamUrl(fileId, requestUrl) : null;

  if (!fileId || !accountId || !upstreamUrl) {
    return new Response("Missing fileId", {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  try {
    let accessToken = await getGoogleAccessToken(accountId);
    let upstream = await fetchGoogleUpstream(request, upstreamUrl, accessToken);

    if (upstream.status === 401 || upstream.status === 403) {
      scopedTokenCache.delete(accountId);
      accessToken = await getGoogleAccessToken(accountId, true);
      upstream = await fetchGoogleUpstream(request, upstreamUrl, accessToken);
    }

    if (!upstream.ok) {
      return new Response((await upstream.text()) || "Preview request failed", {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    const headers = new Headers();
    copyHeaderIfPresent(headers, upstream.headers, "Content-Type");
    copyHeaderIfPresent(headers, upstream.headers, "Content-Length");
    copyHeaderIfPresent(headers, upstream.headers, "Content-Range");
    copyHeaderIfPresent(headers, upstream.headers, "ETag");
    copyHeaderIfPresent(headers, upstream.headers, "Last-Modified");
    copyHeaderIfPresent(headers, upstream.headers, "Accept-Ranges");
    headers.set(
      "Cache-Control",
      request.headers.get("range")
        ? "private, no-store"
        : "private, max-age=120, stale-while-revalidate=300"
    );
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("Vary", "Range");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Preview request failed",
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  }
}
