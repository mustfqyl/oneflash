import { decrypt, encrypt } from "./encryption";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_BASE = "https://www.googleapis.com/drive/v3";
const GOOGLE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

function parseStorageNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function parseGoogleTokenResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        error_description?: string;
      }
    | T
    | null;

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        "error_description" in payload &&
        typeof payload.error_description === "string" &&
        payload.error_description) ||
      (payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string" &&
        payload.error) ||
      fallbackMessage;

    throw new Error(message);
  }

  if (!payload) {
    throw new Error(fallbackMessage);
  }

  return payload as T;
}

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "openid email profile https://www.googleapis.com/auth/drive",
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return parseGoogleTokenResponse<GoogleTokens>(
    res,
    "Google authorization failed"
  );
}

export async function getGoogleDriveAccountEmail(
  accessToken: string
): Promise<string | null> {
  const res = await fetch(`${GOOGLE_API_BASE}/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json().catch(() => null)) as
    | { user?: { emailAddress?: string } }
    | null;

  return data?.user?.emailAddress?.trim() || null;
}

export async function getGoogleDriveStorageQuota(accessToken: string): Promise<{
  limit: number | null;
  usage: number | null;
} | null> {
  const res = await fetch(
    `${GOOGLE_API_BASE}/about?fields=storageQuota(limit,usage)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    return null;
  }

  const data = (await res.json().catch(() => null)) as
    | {
        storageQuota?: {
          limit?: string | number;
          usage?: string | number;
        };
      }
    | null;

  const limit = parseStorageNumber(data?.storageQuota?.limit);
  const usage = parseStorageNumber(data?.storageQuota?.usage);

  if (limit === null && usage === null) {
    return null;
  }

  return {
    limit,
    usage,
  };
}

export async function refreshGoogleToken(
  encryptedRefreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  return parseGoogleTokenResponse<{ access_token: string; expires_in: number }>(
    res,
    "Google token refresh failed"
  );
}

async function getValidToken(
  encryptedAccessToken: string,
  encryptedRefreshToken: string,
  expiresAt: Date | null
): Promise<string> {
  if (expiresAt && expiresAt > new Date()) {
    return decrypt(encryptedAccessToken);
  }
  const { access_token } = await refreshGoogleToken(encryptedRefreshToken);
  return access_token;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  iconLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  exportLinks?: Record<string, string>;
}

export const GOOGLE_PREVIEW_EXPORTS: Record<
  string,
  { mimeType: string; extension: string }
> = {
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

export const GOOGLE_DOWNLOAD_EXPORTS: Record<
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
};

function isGoogleWorkspaceMimeType(mimeType: string) {
  return mimeType.startsWith("application/vnd.google-apps.");
}

export function getGoogleDriveDirectUrl(
  file: Pick<DriveFile, "mimeType" | "webContentLink">
) {
  if (isGoogleWorkspaceMimeType(file.mimeType)) {
    return null;
  }

  return file.webContentLink || null;
}

export function getGoogleDriveBrowserOpenUrl(
  file: Pick<DriveFile, "webContentLink" | "exportLinks">,
  targetMimeType?: string | null
) {
  if (targetMimeType) {
    return file.exportLinks?.[targetMimeType] || null;
  }

  return file.webContentLink || null;
}

export async function listGoogleDriveFiles(
  accessToken: string,
  folderId: string = "root",
  query?: string
): Promise<DriveFile[]> {
  let q = `'${folderId}' in parents and trashed = false`;
  if (query) q += ` and name contains '${query}'`;

  const params = new URLSearchParams({
    q,
    fields:
      "files(id,name,mimeType,size,modifiedTime,parents,iconLink,webViewLink,webContentLink,exportLinks)",
    orderBy: "folder,name",
    pageSize: "100",
  });

  const res = await fetch(`${GOOGLE_API_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.files || [];
}

export async function getGoogleDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFile> {
  const params = new URLSearchParams({
    fields:
      "id,name,mimeType,size,modifiedTime,parents,iconLink,webViewLink,webContentLink,exportLinks",
  });

  const res = await fetch(`${GOOGLE_API_BASE}/files/${fileId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to load Google Drive file metadata");
  }

  return (await res.json()) as DriveFile;
}

export async function uploadToGoogleDrive(
  accessToken: string,
  file: Buffer | Uint8Array,
  name: string,
  mimeType: string,
  folderId: string = "root"
): Promise<DriveFile> {
  const metadata = JSON.stringify({
    name,
    parents: [folderId],
  });

  const boundary = "oneflash_boundary";
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
  ].join("\r\n");

  const bodyEnd = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const bodyStart = encoder.encode(body + "\r\n");
  const bodyEndBytes = encoder.encode(bodyEnd);

  const combined = new Uint8Array(
    bodyStart.length + file.length + bodyEndBytes.length
  );
  combined.set(bodyStart, 0);
  combined.set(file, bodyStart.length);
  combined.set(bodyEndBytes, bodyStart.length + file.length);

  const res = await fetch(
    `${GOOGLE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  );
  return res.json();
}

export async function createGoogleResumableUploadSession(
  accessToken: string,
  {
    name,
    mimeType,
    parentId = "root",
  }: {
    name: string;
    mimeType: string;
    parentId?: string;
  }
) {
  const response = await fetch(
    `${GOOGLE_UPLOAD_URL}?uploadType=resumable&fields=id,name,mimeType,size,modifiedTime,parents,iconLink,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
      },
      body: JSON.stringify({
        name,
        mimeType: mimeType || "application/octet-stream",
        parents: [parentId],
      }),
    }
  );

  if (!response.ok) {
    throw new Error((await response.text()) || "Failed to create Google upload session");
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Google upload session did not return a resumable URL");
  }

  return { uploadUrl };
}

export async function deleteGoogleDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await fetch(`${GOOGLE_API_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function renameGoogleDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<DriveFile> {
  const res = await fetch(`${GOOGLE_API_BASE}/files/${fileId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });
  return res.json();
}

export async function createGoogleDriveFolder(
  accessToken: string,
  name: string,
  parentId: string = "root"
): Promise<DriveFile> {
  const res = await fetch(
    `${GOOGLE_API_BASE}/files?fields=id,name,mimeType,modifiedTime`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );
  return res.json();
}

export async function duplicateGoogleDriveFile(
  accessToken: string,
  fileId: string,
  name: string,
  parentId: string = "root"
): Promise<DriveFile> {
  const res = await fetch(
    `${GOOGLE_API_BASE}/files/${fileId}/copy?fields=id,name,mimeType,size,modifiedTime,parents,iconLink,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        parents: [parentId],
      }),
    }
  );
  return res.json();
}

export async function moveGoogleDriveFile(
  accessToken: string,
  fileId: string,
  sourceParentId: string,
  targetParentId: string
): Promise<DriveFile> {
  const params = new URLSearchParams({
    addParents: targetParentId,
    removeParents: sourceParentId,
    fields: "id,name,mimeType,size,modifiedTime,parents,iconLink,webViewLink",
  });

  const res = await fetch(`${GOOGLE_API_BASE}/files/${fileId}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

export async function downloadGoogleDriveFile(
  accessToken: string,
  fileId: string,
  options?: {
    range?: string | null;
  }
): Promise<Response> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (options?.range) {
    headers.Range = options.range;
  }

  return fetch(`${GOOGLE_API_BASE}/files/${fileId}?alt=media`, {
    headers,
  });
}

export async function exportGoogleDriveFile(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<Response> {
  return fetch(
    `${GOOGLE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export { getValidToken as getValidGoogleToken, encrypt as encryptToken };
