import { zipSync, strToU8 } from "fflate";
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
  listGoogleDriveFiles,
} from "@/lib/google-drive";
import {
  downloadOneDriveFile,
  listOneDriveFiles,
} from "@/lib/onedrive";
import {
  acquireConcurrencySlot,
  checkRateLimit,
  createBusyResponse,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/security";

export const runtime = "nodejs";

const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_FOLDER_DOWNLOAD_FILES = 200;
const MAX_FOLDER_DOWNLOAD_TOTAL_KNOWN_BYTES = 256 * 1024 * 1024;
const FOLDER_DOWNLOAD_LIMIT_ERROR =
  "Folder download limit exceeded. Download smaller batches to protect server capacity.";
const GOOGLE_EXPORT_FORMATS: Record<
  string,
  { mimeType: string; extension: string }
> = {
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
  "application/vnd.google-apps.script": {
    mimeType: "application/vnd.google-apps.script+json",
    extension: "json",
  },
  "application/vnd.google-apps.vid": {
    mimeType: "video/mp4",
    extension: "mp4",
  },
};

function sanitizeZipSegment(segment: string) {
  return segment.replace(/[\\/:*?"<>|]/g, "_").trim() || "untitled";
}

function ensureExtension(name: string, extension: string) {
  return name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
    ? name
    : `${name}.${extension}`;
}

type FolderDownloadBudget = {
  fileCount: number;
  totalKnownBytes: number;
};

function parseKnownSize(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function consumeFolderDownloadBudget(
  budget: FolderDownloadBudget,
  knownSize: string | number | undefined
) {
  budget.fileCount += 1;
  budget.totalKnownBytes += parseKnownSize(knownSize);

  if (
    budget.fileCount > MAX_FOLDER_DOWNLOAD_FILES ||
    budget.totalKnownBytes > MAX_FOLDER_DOWNLOAD_TOTAL_KNOWN_BYTES
  ) {
    throw new Error(FOLDER_DOWNLOAD_LIMIT_ERROR);
  }
}

async function readResponseBytes(response: Response) {
  return new Uint8Array(await response.arrayBuffer());
}

async function addGoogleFolderToZip({
  accessToken,
  folderId,
  folderPath,
  budget,
  zipEntries,
  errors,
}: {
  accessToken: string;
  folderId: string;
  folderPath: string;
  budget: FolderDownloadBudget;
  zipEntries: Record<string, Uint8Array>;
  errors: string[];
}) {
  const children = await listGoogleDriveFiles(accessToken, folderId);

  for (const child of children) {
    const childPath = `${folderPath}/${sanitizeZipSegment(child.name)}`;

    if (child.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
      await addGoogleFolderToZip({
        accessToken,
        folderId: child.id,
        folderPath: childPath,
        budget,
        zipEntries,
        errors,
      });
      continue;
    }

    try {
      consumeFolderDownloadBudget(budget, child.size);
      if (child.mimeType.startsWith("application/vnd.google-apps.")) {
        const exportFormat = GOOGLE_EXPORT_FORMATS[child.mimeType];
        if (!exportFormat) {
          errors.push(`${childPath}: unsupported Google Workspace type (${child.mimeType})`);
          continue;
        }

        const exported = await exportGoogleDriveFile(
          accessToken,
          child.id,
          exportFormat.mimeType
        );
        if (!exported.ok) {
          errors.push(`${childPath}: export failed (${exported.status})`);
          continue;
        }

        zipEntries[
          ensureExtension(childPath, exportFormat.extension)
        ] = await readResponseBytes(exported);
        continue;
      }

      const downloaded = await downloadGoogleDriveFile(accessToken, child.id);
      if (!downloaded.ok) {
        errors.push(`${childPath}: download failed (${downloaded.status})`);
        continue;
      }

      zipEntries[childPath] = await readResponseBytes(downloaded);
    } catch (error) {
      if (error instanceof Error && error.message === FOLDER_DOWNLOAD_LIMIT_ERROR) {
        throw error;
      }
      errors.push(
        `${childPath}: ${error instanceof Error ? error.message : "download failed"}`
      );
    }
  }
}

async function addOneDriveFolderToZip({
  accessToken,
  folderId,
  folderPath,
  budget,
  zipEntries,
  errors,
}: {
  accessToken: string;
  folderId: string;
  folderPath: string;
  budget: FolderDownloadBudget;
  zipEntries: Record<string, Uint8Array>;
  errors: string[];
}) {
  const children = await listOneDriveFiles(accessToken, folderId);

  for (const child of children) {
    const childPath = `${folderPath}/${sanitizeZipSegment(child.name)}`;

    if (child.folder) {
      await addOneDriveFolderToZip({
        accessToken,
        folderId: child.id,
        folderPath: childPath,
        budget,
        zipEntries,
        errors,
      });
      continue;
    }

    try {
      consumeFolderDownloadBudget(budget, child.size);
      const downloaded = await downloadOneDriveFile(accessToken, child.id);
      if (!downloaded.ok) {
        errors.push(`${childPath}: download failed (${downloaded.status})`);
        continue;
      }

      zipEntries[childPath] = await readResponseBytes(downloaded);
    } catch (error) {
      if (error instanceof Error && error.message === FOLDER_DOWNLOAD_LIMIT_ERROR) {
        throw error;
      }
      errors.push(
        `${childPath}: ${error instanceof Error ? error.message : "download failed"}`
      );
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  let downloadLease:
    | ReturnType<typeof acquireConcurrencySlot>
    | null = null;

  try {
    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit({
      key: `cloud-folder-download:${access.user.id}:${getClientIp(req.headers)}`,
      limit: 4,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many folder download requests. Please wait before trying again."
      );
    }

    downloadLease = acquireConcurrencySlot({
      key: "cloud-folder-download",
      limit: 2,
    });
    if (!downloadLease.allowed) {
      return createBusyResponse(
        "This server is already building other folder downloads. Please retry shortly.",
        downloadLease.retryAfterSeconds
      );
    }

    const { provider } = await params;
    if (provider !== "google" && provider !== "onedrive") {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const folderId = req.nextUrl.searchParams.get("folderId");
    const folderName = sanitizeZipSegment(
      req.nextUrl.searchParams.get("name") || "folder"
    );

    if (!folderId) {
      return NextResponse.json({ error: "Missing folderId" }, { status: 400 });
    }

    const requestedAccountId =
      req.nextUrl.searchParams.get("accountId") || getScopedCloudAccountId(folderId);
    const remoteFolderId = getScopedCloudRemoteId(folderId);
    if (!remoteFolderId) {
      return NextResponse.json({ error: "Missing folderId" }, { status: 400 });
    }

    const zipEntries: Record<string, Uint8Array> = {};
    const errors: string[] = [];
    const budget: FolderDownloadBudget = {
      fileCount: 0,
      totalKnownBytes: 0,
    };

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
      await addGoogleFolderToZip({
        accessToken,
        folderId: remoteFolderId,
        folderPath: folderName,
        budget,
        zipEntries,
        errors,
      });
    } else {
      const { account } = await resolveCloudAccount(
        access.user.id,
        "onedrive",
        requestedAccountId
      );
      if (!account) {
        return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
      }

      const accessToken = await getCloudAccessToken(account);
      await addOneDriveFolderToZip({
        accessToken,
        folderId: remoteFolderId,
        folderPath: folderName,
        budget,
        zipEntries,
        errors,
      });
    }

    if (Object.keys(zipEntries).length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: `Folder could not be downloaded.\n${errors.join("\n")}` },
        { status: 502 }
      );
    }

    if (errors.length > 0) {
      zipEntries[`${folderName}/oneflash-download-errors.txt`] = strToU8(
        errors.join("\n"),
        true
      );
    }

    const archive = Uint8Array.from(zipSync(zipEntries, { level: 0 }));

    return new NextResponse(new Blob([archive], { type: "application/zip" }), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          `${folderName}.zip`
        )}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message === FOLDER_DOWNLOAD_LIMIT_ERROR
    ) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }

    console.error("Download folder error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    downloadLease?.release();
  }
}
