import { decrypt, encrypt } from "./encryption";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

async function parseMicrosoftTokenResponse<T>(
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

export function getOneDriveAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "Files.ReadWrite User.Read offline_access",
    response_mode: "query",
    prompt: "select_account",
    state,
  });
  return `${MS_AUTH_URL}?${params.toString()}`;
}

export async function exchangeOneDriveCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
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
  return parseMicrosoftTokenResponse<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>(res, "Microsoft authorization failed");
}

export async function getOneDriveAccountEmail(
  accessToken: string
): Promise<string | null> {
  const drivesResponse = await fetch(`${GRAPH_API_BASE}/me/drives?$top=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (drivesResponse.ok) {
    const drivesData = (await drivesResponse.json().catch(() => null)) as
      | {
          value?: Array<{
            owner?: { user?: { email?: string } };
            lastModifiedBy?: { user?: { email?: string } };
          }>;
        }
      | null;
    const drive = drivesData?.value?.[0];
    const driveEmail =
      drive?.owner?.user?.email?.trim() ||
      drive?.lastModifiedBy?.user?.email?.trim() ||
      null;
    if (driveEmail) {
      return driveEmail;
    }
  }

  const meResponse = await fetch(`${GRAPH_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meResponse.ok) {
    return null;
  }

  const meData = (await meResponse.json().catch(() => null)) as
    | { userPrincipalName?: string; mail?: string }
    | null;

  return meData?.userPrincipalName?.trim() || meData?.mail?.trim() || null;
}

export async function getOneDriveStorageQuota(accessToken: string): Promise<{
  total: number | null;
  used: number | null;
  remaining: number | null;
} | null> {
  const res = await fetch(`${GRAPH_API_BASE}/me/drive?$select=quota`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json().catch(() => null)) as
    | {
        quota?: {
          total?: number | string;
          used?: number | string;
          remaining?: number | string;
        };
      }
    | null;

  const total = parseStorageNumber(data?.quota?.total);
  const used = parseStorageNumber(data?.quota?.used);
  const remaining = parseStorageNumber(data?.quota?.remaining);

  if (total === null && used === null && remaining === null) {
    return null;
  }

  return {
    total,
    used,
    remaining,
  };
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
      scope: "Files.ReadWrite User.Read offline_access",
    }),
  });
  return parseMicrosoftTokenResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>(res, "Microsoft token refresh failed");
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
      ? `/me/drive/root:/${encodeURIComponent(name)}:/content`
      : `/me/drive/items/${folderId}:/${encodeURIComponent(name)}:/content`;

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

export async function createOneDriveUploadSession(
  accessToken: string,
  {
    name,
    parentId = "root",
  }: {
    name: string;
    parentId?: string;
  }
) {
  const encodedName = encodeURIComponent(name);
  const path =
    parentId === "root"
      ? `/me/drive/root:/${encodedName}:/createUploadSession`
      : `/me/drive/items/${parentId}:/${encodedName}:/createUploadSession`;

  const response = await fetch(`${GRAPH_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
      },
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | { uploadUrl?: string; expirationDateTime?: string }
    | null;

  if (!response.ok || !data?.uploadUrl) {
    throw new Error("Failed to create OneDrive upload session");
  }

  return {
    uploadUrl: data.uploadUrl,
    expirationDateTime: data.expirationDateTime || null,
  };
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

  return fetch(`${GRAPH_API_BASE}/me/drive/items/${fileId}/content`, {
    headers,
    redirect: "follow",
  });
}

export { encrypt as encryptToken };
