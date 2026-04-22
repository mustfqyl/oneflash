import { decrypt, encrypt } from "./encryption";

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_BASE = "https://www.googleapis.com/drive/v3";
const GOOGLE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export function getGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive",
    access_type: "offline",
    prompt: "consent",
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
  return res.json();
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
  return res.json();
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
      "files(id,name,mimeType,size,modifiedTime,parents,iconLink,webViewLink)",
    orderBy: "folder,name",
    pageSize: "100",
  });

  const res = await fetch(`${GOOGLE_API_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.files || [];
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
  fileId: string
): Promise<Response> {
  return fetch(`${GOOGLE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export { getValidToken as getValidGoogleToken, encrypt as encryptToken };
