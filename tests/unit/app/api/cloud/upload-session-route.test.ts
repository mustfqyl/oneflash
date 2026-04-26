import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createGoogleResumableUploadSessionMock,
  createOneDriveUploadSessionMock,
  getCloudAccessTokenMock,
  resolveCloudAccountMock,
  resolveRequestAccessMock,
} = vi.hoisted(() => ({
  createGoogleResumableUploadSessionMock: vi.fn(),
  createOneDriveUploadSessionMock: vi.fn(),
  getCloudAccessTokenMock: vi.fn(),
  resolveCloudAccountMock: vi.fn(),
  resolveRequestAccessMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  resolveRequestAccess: resolveRequestAccessMock,
}));

vi.mock("@/lib/cloud-accounts", () => ({
  getCloudAccessToken: getCloudAccessTokenMock,
  getScopedCloudAccountId: vi.fn(() => null),
  getScopedCloudRemoteId: vi.fn(() => null),
  resolveCloudAccount: resolveCloudAccountMock,
}));

vi.mock("@/lib/google-drive", () => ({
  createGoogleResumableUploadSession: createGoogleResumableUploadSessionMock,
}));

vi.mock("@/lib/onedrive", () => ({
  createOneDriveUploadSession: createOneDriveUploadSessionMock,
}));

import { POST } from "@/app/api/cloud/[provider]/upload-session/route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cloud/[provider]/upload-session", () => {
  it("creates a batch of upload sessions while reusing account and token resolution", async () => {
    resolveRequestAccessMock.mockResolvedValue({
      access: { user: { id: "user-1" } },
    });
    resolveCloudAccountMock.mockResolvedValue({
      account: { id: "account-1" },
      accounts: [{ id: "account-1" }],
    });
    getCloudAccessTokenMock.mockResolvedValue("token-1");
    createGoogleResumableUploadSessionMock.mockImplementation(
      async (_accessToken: string, { name }: { name: string }) => ({
        uploadUrl: `https://uploads.example/${name}`,
      })
    );

    const request = new NextRequest("http://localhost/api/cloud/google/upload-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({
        files: [
          { name: "one.mp4", mimeType: "video/mp4", folderId: "root" },
          { name: "two.mp4", mimeType: "video/mp4", folderId: "root" },
          { name: "three.mp4", mimeType: "video/mp4", folderId: "root" },
        ],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ provider: "google" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessions: [
        { uploadUrl: "https://uploads.example/one.mp4" },
        { uploadUrl: "https://uploads.example/two.mp4" },
        { uploadUrl: "https://uploads.example/three.mp4" },
      ],
    });
    expect(resolveCloudAccountMock).toHaveBeenCalledTimes(1);
    expect(getCloudAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(createGoogleResumableUploadSessionMock).toHaveBeenCalledTimes(3);
  });

  it("keeps the single-file response shape for existing callers", async () => {
    resolveRequestAccessMock.mockResolvedValue({
      access: { user: { id: "user-1" } },
    });
    resolveCloudAccountMock.mockResolvedValue({
      account: { id: "account-1" },
      accounts: [{ id: "account-1" }],
    });
    getCloudAccessTokenMock.mockResolvedValue("token-1");
    createGoogleResumableUploadSessionMock.mockResolvedValue({
      uploadUrl: "https://uploads.example/video.mp4",
    });

    const request = new NextRequest("http://localhost/api/cloud/google/upload-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({
        name: "video.mp4",
        mimeType: "video/mp4",
        folderId: "root",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ provider: "google" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      uploadUrl: "https://uploads.example/video.mp4",
    });
    expect(createGoogleResumableUploadSessionMock).toHaveBeenCalledTimes(1);
  });
});
