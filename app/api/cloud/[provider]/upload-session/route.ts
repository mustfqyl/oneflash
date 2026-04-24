import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  getCloudAccessToken,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import { createGoogleResumableUploadSession } from "@/lib/google-drive";
import { createOneDriveUploadSession } from "@/lib/onedrive";
import { ensureTrustedOrigin } from "@/lib/security";
import { getItemNameValidationError } from "@/lib/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await params;
    const { name, mimeType, folderId, accountId } = (await req.json()) as {
      name?: string;
      mimeType?: string;
      folderId?: string;
      accountId?: string;
    };

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    const nameError = getItemNameValidationError(name, "File name");
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    const targetFolderId =
      typeof folderId === "string" && folderId.trim().length > 0 ? folderId : "root";
    const requestedAccountId = accountId || getScopedCloudAccountId(targetFolderId);
    const remoteFolderId = getScopedCloudRemoteId(targetFolderId) || "root";

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
      const session = await createGoogleResumableUploadSession(accessToken, {
        name,
        mimeType: mimeType || "application/octet-stream",
        parentId: remoteFolderId,
      });
      return NextResponse.json(session);
    }

    if (provider === "onedrive") {
      const { account } = await resolveCloudAccount(
        access.user.id,
        "onedrive",
        requestedAccountId
      );
      if (!account) {
        return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
      }

      const accessToken = await getCloudAccessToken(account);
      const session = await createOneDriveUploadSession(accessToken, {
        name,
        parentId: remoteFolderId,
      });
      return NextResponse.json(session);
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Create upload session error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
