import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  decodeScopedCloudItemId,
  encodeScopedCloudItemId,
  getCloudAccessToken,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
  listCloudAccounts,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import {
  type OneDriveItem,
  listOneDriveFiles,
  deleteOneDriveFile,
  renameOneDriveFile,
  createOneDriveFolder,
  duplicateOneDriveFile,
  moveOneDriveFile,
} from "@/lib/onedrive";
import { ensureTrustedOrigin } from "@/lib/security";
import { getItemNameValidationError } from "@/lib/validation";

type OneDriveAccountSummary = {
  id: string;
  email: string | null;
};

function toResponseFile(file: OneDriveItem, account: OneDriveAccountSummary) {
  return {
    ...file,
    id: encodeScopedCloudItemId(account.id, file.id),
    accountId: account.id,
    accountEmail: account.email,
  };
}

function sortOneDriveFiles<T extends OneDriveItem>(files: T[]) {
  return [...files].sort((left, right) => {
    const leftIsFolder = Boolean(left.folder);
    const rightIsFolder = Boolean(right.folder);
    if (leftIsFolder !== rightIsFolder) {
      return leftIsFolder ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function ensureScopedAccountMatch(
  value: string | null | undefined,
  accountId: string,
  fieldName: string
) {
  const scopedValue = decodeScopedCloudItemId(value);
  if (scopedValue && scopedValue.accountId !== accountId) {
    throw new Error(`${fieldName} must stay in the same connected account`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folderId = req.nextUrl.searchParams.get("folderId") || "root";
    const requestedAccountId =
      req.nextUrl.searchParams.get("accountId") || getScopedCloudAccountId(folderId);
    const remoteFolderId = getScopedCloudRemoteId(folderId) || "root";
    const query = req.nextUrl.searchParams.get("q") || undefined;
    const accounts = await listCloudAccounts(access.user.id, "onedrive");

    if (accounts.length === 0) {
      return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
    }

    if (!requestedAccountId && folderId === "root" && accounts.length > 1) {
      const providerFiles = await Promise.all(
        accounts.map(async (account) => {
          const accessToken = await getCloudAccessToken(account);
          const files = await listOneDriveFiles(accessToken, "root", query);
          return sortOneDriveFiles(files).map((file) => toResponseFile(file, account));
        })
      );

      return NextResponse.json({
        files: providerFiles
          .flat()
          .sort((left, right) => {
            const leftIsFolder = Boolean(left.folder);
            const rightIsFolder = Boolean(right.folder);
            if (leftIsFolder !== rightIsFolder) {
              return leftIsFolder ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
          }),
      });
    }

    const { account } = await resolveCloudAccount(
      access.user.id,
      "onedrive",
      requestedAccountId
    );
    if (!account) {
      return NextResponse.json(
        { error: "Selected OneDrive account was not found" },
        { status: 400 }
      );
    }

    const accessToken = await getCloudAccessToken(account);
    const files = await listOneDriveFiles(accessToken, remoteFolderId, query);
    return NextResponse.json({
      files: sortOneDriveFiles(files).map((file) => toResponseFile(file, account)),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("OneDrive files error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const { fileId } = (await req.json()) as { fileId?: string };
    const requestedAccountId = getScopedCloudAccountId(fileId);
    const remoteFileId = getScopedCloudRemoteId(fileId);

    if (!remoteFileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const { account } = await resolveCloudAccount(
      access.user.id,
      "onedrive",
      requestedAccountId
    );
    if (!account) {
      return NextResponse.json(
        { error: "Selected OneDrive account was not found" },
        { status: 400 }
      );
    }

    const accessToken = await getCloudAccessToken(account);
    await deleteOneDriveFile(accessToken, remoteFileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("OneDrive delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

    const { fileId, newName, action, parentId, targetParentId } = (await req.json()) as {
      fileId?: string;
      newName?: string;
      action?: string;
      parentId?: string;
      targetParentId?: string;
    };

    const requestedAccountId = getScopedCloudAccountId(fileId);
    const remoteFileId = getScopedCloudRemoteId(fileId);
    if (!remoteFileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const { account } = await resolveCloudAccount(
      access.user.id,
      "onedrive",
      requestedAccountId
    );
    if (!account) {
      return NextResponse.json(
        { error: "Selected OneDrive account was not found" },
        { status: 400 }
      );
    }

    const accessToken = await getCloudAccessToken(account);

    if (action === "duplicate") {
      if (typeof newName === "string" && newName.trim()) {
        const nameError = getItemNameValidationError(newName, "File name");
        if (nameError) {
          return NextResponse.json({ error: nameError }, { status: 400 });
        }
      }
      ensureScopedAccountMatch(parentId, account.id, "Target folder");
      await duplicateOneDriveFile(
        accessToken,
        remoteFileId,
        newName || "Copy",
        getScopedCloudRemoteId(parentId) || "root"
      );
      return NextResponse.json({ success: true });
    }

    if (action === "move") {
      ensureScopedAccountMatch(targetParentId, account.id, "Target folder");
      const file = await moveOneDriveFile(
        accessToken,
        remoteFileId,
        getScopedCloudRemoteId(targetParentId) || "root"
      );
      return NextResponse.json({ file: toResponseFile(file, account) });
    }

    const normalizedName = (newName || "").trim();
    const nameError = getItemNameValidationError(normalizedName, "File name");
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    const file = await renameOneDriveFile(accessToken, remoteFileId, normalizedName);
    return NextResponse.json({ file: toResponseFile(file, account) });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Select a connected account first" ||
        error.message.includes("must stay in the same connected account"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("OneDrive rename error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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

    const { name, parentId, accountId } = (await req.json()) as {
      name?: string;
      parentId?: string;
      accountId?: string;
    };

    const requestedAccountId = accountId || getScopedCloudAccountId(parentId);
    const { account } = await resolveCloudAccount(
      access.user.id,
      "onedrive",
      requestedAccountId
    );
    if (!account) {
      return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
    }

    const folderName = name || "New Folder";
    const nameError = getItemNameValidationError(folderName, "Folder name");
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    const accessToken = await getCloudAccessToken(account);
    const folder = await createOneDriveFolder(
      accessToken,
      folderName.trim(),
      getScopedCloudRemoteId(parentId) || "root"
    );
    return NextResponse.json({ folder: toResponseFile(folder, account) });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("OneDrive create folder error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
