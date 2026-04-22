import { decrypt, encrypt } from "./encryption";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

export function getOneDriveAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "Files.ReadWrite offline_access",
    response_mode: "query",
  });
  return `${MS_AUTH_URL}?${params.toString()}`;
}

export async function exchangeOneDriveCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshOneDriveToken(
  encryptedRefreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      scope: "Files.ReadWrite offline_access",
    }),
  });
  return res.json();
}

export interface OneDriveItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  webUrl?: string;
  parentReference?: { id: string; path: string };
}

export async function listOneDriveFiles(
  accessToken: string,
  folderId: string = "root",
  query?: string
): Promise<OneDriveItem[]> {
  let url: string;
  if (query) {
    url = `${GRAPH_API_BASE}/me/drive/search(q='${encodeURIComponent(query)}')`;
  } else if (folderId === "root") {
    url = `${GRAPH_API_BASE}/me/drive/root/children?$orderby=name&$top=100`;
  } else {
    url = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children?$orderby=name&$top=100`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.value || [];
}

export async function uploadToOneDrive(
  accessToken: string,
  file: Buffer | Uint8Array,
  name: string,
  folderId: string = "root"
): Promise<OneDriveItem> {
  const path =
    folderId === "root"
      ? `/me/drive/root:/${name}:/content`
      : `/me/drive/items/${folderId}:/${name}:/content`;

  const res = await fetch(`${GRAPH_API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: file as BodyInit,
  });
  return res.json();
}

export async function deleteOneDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function renameOneDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<OneDriveItem> {
  const res = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });
  return res.json();
}

export async function createOneDriveFolder(
  accessToken: string,
  name: string,
  parentId: string = "root"
): Promise<OneDriveItem> {
  const path =
    parentId === "root"
      ? `/me/drive/root/children`
      : `/me/drive/items/${parentId}/children`;

  const res = await fetch(`${GRAPH_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });
  return res.json();
}

export async function duplicateOneDriveFile(
  accessToken: string,
  fileId: string,
  name: string,
  parentId: string = "root"
): Promise<void> {
  const target =
    parentId === "root"
      ? { path: "/drive/root:/" }
      : { id: parentId };

  await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}/copy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "respond-async",
    },
    body: JSON.stringify({
      parentReference: target,
      name,
    }),
  });
}

export async function moveOneDriveFile(
  accessToken: string,
  fileId: string,
  targetParentId: string = "root"
): Promise<OneDriveItem> {
  const parentReference =
    targetParentId === "root"
      ? { path: "/drive/root:/" }
      : { id: targetParentId };

  const res = await fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parentReference }),
  });
  return res.json();
}

export async function downloadOneDriveFile(
  accessToken: string,
  fileId: string
): Promise<Response> {
  return fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "follow",
  });
}

export { encrypt as encryptToken };
