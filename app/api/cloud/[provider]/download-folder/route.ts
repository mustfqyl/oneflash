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
  type DriveFile,
  downloadGoogleDriveFile,
  exportGoogleDriveFile,
  listGoogleDriveFiles,
} from "@/lib/google-drive";
import {
  type OneDriveItem,
  downloadOneDriveFile,
  listOneDriveFiles,
} from "@/lib/onedrive";

export const runtime = "nodejs";

const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
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

async function readResponseBytes(response: Response) {
  return new Uint8Array(await response.arrayBuffer());
}

async function addGoogleFolderToZip({
  accessToken,
  folderId,
  folderPath,
  zipEntries,
  errors,
}: {
  accessToken: string;
  folderId: string;
  folderPath: string;
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
        zipEntries,
        errors,
      });
      continue;
    }

    try {
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
  zipEntries,
  errors,
}: {
  accessToken: string;
  folderId: string;
  folderPath: string;
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
        zipEntries,
        errors,
      });
      continue;
    }

    try {
      const downloaded = await downloadOneDriveFile(accessToken, child.id);
      if (!downloaded.ok) {
        errors.push(`${childPath}: download failed (${downloaded.status})`);
        continue;
      }

      zipEntries[childPath] = await readResponseBytes(downloaded);
    } catch (error) {
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
  try {
    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    console.error("Download folder error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
