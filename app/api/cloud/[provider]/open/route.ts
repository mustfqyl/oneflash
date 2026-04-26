import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  getCloudAccessToken,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import {
  acquireConcurrencySlot,
  checkRateLimit,
  createBusyResponse,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/security";
import {
  downloadGoogleDriveFile,
  exportGoogleDriveFile,
  getGoogleDriveBrowserOpenUrl,
  getGoogleDriveFileMetadata,
  GOOGLE_DOWNLOAD_EXPORTS,
  GOOGLE_PREVIEW_EXPORTS,
} from "@/lib/google-drive";
import {
  downloadOneDriveFile,
  getOneDriveDirectDownloadUrl,
} from "@/lib/onedrive";
import { resolveFileMimeType } from "@/lib/file-mime";

const PREVIEW_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=900";
const TRANSFER_CONCURRENCY_LIMITS = {
  preview: 32,
  download: 12,
} as const;

function shouldProxyInlineMediaPreview(
  forceDownload: boolean,
  requestedMimeType: string | null
) {
  return (
    !forceDownload &&
    Boolean(
      requestedMimeType &&
        (requestedMimeType.startsWith("video/") ||
          requestedMimeType.startsWith("audio/"))
    )
  );
}

function ensureExtension(name: string, extension: string) {
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
 ) {
  let proxyLease:
    | ReturnType<typeof acquireConcurrencySlot>
    | null = null;

  try {
    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await params;
    const fileId = req.nextUrl.searchParams.get("fileId");
    const fileName = req.nextUrl.searchParams.get("name");
    const requestedMimeType = req.nextUrl.searchParams.get("mimeType");
    const forceDownload = req.nextUrl.searchParams.get("download") === "1";
    const range = req.headers.get("range");
    const transferType = forceDownload ? "download" : "preview";
    const forceSameOriginInlinePreview = shouldProxyInlineMediaPreview(
      forceDownload,
      requestedMimeType
    );
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const rateLimit = checkRateLimit({
      key: `cloud-open:${transferType}:${access.user.id}:${getClientIp(req.headers)}`,
      limit: forceDownload ? 60 : 240,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        forceDownload
          ? "Too many file downloads at once. Please retry shortly."
          : "Too many file preview requests at once. Please retry shortly."
      );
    }

    const requestedAccountId =
      req.nextUrl.searchParams.get("accountId") || getScopedCloudAccountId(fileId);
    const remoteFileId = getScopedCloudRemoteId(fileId);
    if (!remoteFileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    let upstream: Response;

    if (provider === "google") {
      const { account } = await resolveCloudAccount(
        access.user.id,
        "google",
        requestedAccountId
      );
      if (!account) {
        return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 });
      }
      const accessToken = await getCloudAccessToken(account);
      const exportMap = forceDownload ? GOOGLE_DOWNLOAD_EXPORTS : GOOGLE_PREVIEW_EXPORTS;
      const exportTarget = requestedMimeType ? exportMap[requestedMimeType] : null;
      if (forceDownload) {
        const metadata = await getGoogleDriveFileMetadata(accessToken, remoteFileId);
        const directBrowserUrl = getGoogleDriveBrowserOpenUrl(
          metadata,
          exportTarget?.mimeType
        );

        if (directBrowserUrl) {
          const redirectResponse = NextResponse.redirect(directBrowserUrl, 307);
          redirectResponse.headers.set("Cache-Control", "private, no-store");
          redirectResponse.headers.set("Referrer-Policy", "no-referrer");
          return redirectResponse;
        }
      }

      proxyLease = acquireConcurrencySlot({
        key: `cloud-open-proxy:google:${transferType}`,
        limit: TRANSFER_CONCURRENCY_LIMITS[transferType],
      });
      if (!proxyLease.allowed) {
        return createBusyResponse(
          "Google Drive transfers are saturated on this instance. Please retry shortly.",
          proxyLease.retryAfterSeconds
        );
      }

      upstream = exportTarget
        ? await exportGoogleDriveFile(accessToken, remoteFileId, exportTarget.mimeType)
        : await downloadGoogleDriveFile(accessToken, remoteFileId, { range });

      if (exportTarget && fileName) {
        req.nextUrl.searchParams.set(
          "name",
          ensureExtension(fileName, exportTarget.extension)
        );
      }
    } else if (provider === "onedrive") {
      const { account } = await resolveCloudAccount(
        access.user.id,
        "onedrive",
        requestedAccountId
      );
      if (!account) {
        return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
      }
      const accessToken = await getCloudAccessToken(account);
      const directDownloadUrl = await getOneDriveDirectDownloadUrl(
        accessToken,
        remoteFileId
      );
      if (directDownloadUrl && !forceSameOriginInlinePreview) {
        const redirectResponse = NextResponse.redirect(directDownloadUrl, 307);
        redirectResponse.headers.set("Cache-Control", "private, no-store");
        redirectResponse.headers.set("Referrer-Policy", "no-referrer");
        return redirectResponse;
      }

      proxyLease = acquireConcurrencySlot({
        key: `cloud-open-proxy:onedrive:${transferType}`,
        limit: TRANSFER_CONCURRENCY_LIMITS[transferType],
      });
      if (!proxyLease.allowed) {
        return createBusyResponse(
          "OneDrive transfers are saturated on this instance. Please retry shortly.",
          proxyLease.retryAfterSeconds
        );
      }

      upstream = await downloadOneDriveFile(accessToken, remoteFileId, { range });
    } else {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    if (!upstream.ok) {
      const bodyText = await upstream.text();
      let message = bodyText || "Failed to open file";

      try {
        const parsed = JSON.parse(bodyText) as
          | { error?: string | { message?: string } }
          | undefined;
        if (typeof parsed?.error === "string") {
          message = parsed.error;
        } else if (parsed?.error && typeof parsed.error.message === "string") {
          message = parsed.error.message;
        }
      } catch {
        // Keep the raw upstream message when it isn't valid JSON.
      }

      return NextResponse.json(
        { error: message || "Failed to open file" },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    const effectiveFileName = req.nextUrl.searchParams.get("name") || fileName;
    headers.set(
      "Content-Type",
      resolveFileMimeType(
        effectiveFileName || "",
        upstream.headers.get("Content-Type") || "application/octet-stream"
      )
    );
    headers.set(
      "Cache-Control",
      !forceDownload && !range ? PREVIEW_CACHE_CONTROL : "private, no-store"
    );
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("Vary", "Range");

    const contentDisposition = upstream.headers.get("Content-Disposition");
    if (contentDisposition) {
      let nextDisposition = forceDownload
        ? contentDisposition.replace("inline", "attachment")
        : contentDisposition.replace("attachment", "inline");

      if (forceDownload && effectiveFileName) {
        const encodedName = encodeURIComponent(effectiveFileName);
        nextDisposition = `attachment; filename*=UTF-8''${encodedName}`;
      }

      headers.set("Content-Disposition", nextDisposition);
    } else if (forceDownload && effectiveFileName) {
      headers.set(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(effectiveFileName)}`
      );
    } else {
      headers.set("Content-Disposition", forceDownload ? "attachment" : "inline");
    }

    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    const contentRange = upstream.headers.get("Content-Range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    const acceptRanges = upstream.headers.get("Accept-Ranges");
    if (acceptRanges) {
      headers.set("Accept-Ranges", acceptRanges);
    } else {
      headers.set("Accept-Ranges", "bytes");
    }

    const etag = upstream.headers.get("ETag");
    if (etag) {
      headers.set("ETag", etag);
    }

    const lastModified = upstream.headers.get("Last-Modified");
    if (lastModified) {
      headers.set("Last-Modified", lastModified);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Open file error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    proxyLease?.release();
  }
}
