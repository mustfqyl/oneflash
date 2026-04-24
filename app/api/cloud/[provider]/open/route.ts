import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  getCloudAccessToken,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import {
  downloadGoogleDriveFile,
  exportGoogleDriveFile,
} from "@/lib/google-drive";
import { downloadOneDriveFile } from "@/lib/onedrive";
import { resolveFileMimeType } from "@/lib/file-mime";

const GOOGLE_PREVIEW_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
};

const GOOGLE_DOWNLOAD_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
};

function ensureExtension(name: string, extension: string) {
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
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
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
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
    headers.set("Cache-Control", "private, no-store");

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
  }
}
