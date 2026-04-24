import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  encodeScopedCloudItemId,
  getCloudAccessToken,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import { uploadToOneDrive } from "@/lib/onedrive";
import { ensureTrustedOrigin } from "@/lib/security";
import { getItemNameValidationError } from "@/lib/validation";

export async function POST(req: NextRequest) {
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

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Upload body could not be parsed. If the file is large, restart the dev server after increasing proxyClientMaxBodySize.",
        },
        { status: 413 }
      );
    }

    const file = formData.get("file") as File | null;
    const folderId = ((formData.get("folderId") as string) || "root").trim() || "root";
    const requestedAccountId =
      (formData.get("accountId") as string | null) || getScopedCloudAccountId(folderId);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const nameError = getItemNameValidationError(file.name, "File name");
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    const { account } = await resolveCloudAccount(
      access.user.id,
      "onedrive",
      requestedAccountId
    );
    if (!account) {
      return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
    }

    const accessToken = await getCloudAccessToken(account);
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await uploadToOneDrive(
      accessToken,
      buffer,
      file.name,
      getScopedCloudRemoteId(folderId) || "root"
    );

    return NextResponse.json({
      file: {
        ...result,
        id: encodeScopedCloudItemId(account.id, result.id),
        accountId: account.id,
        accountEmail: account.email ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("OneDrive upload error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
