import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import {
  listOneDriveFiles,
  deleteOneDriveFile,
  renameOneDriveFile,
  createOneDriveFolder,
  duplicateOneDriveFile,
  moveOneDriveFile,
  refreshOneDriveToken,
} from "@/lib/onedrive";

async function getOneDriveAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.cloudAccount.findUnique({
    where: { userId_provider: { userId, provider: "ONEDRIVE" } },
  });
  if (!account) return null;

  // Check if token is expired
  if (account.expiresAt && account.expiresAt < new Date()) {
    const { access_token, refresh_token, expires_in } = await refreshOneDriveToken(account.refreshToken);
    await prisma.cloudAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(access_token),
        refreshToken: encrypt(refresh_token), // Refresh token changes too
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });
    return access_token;
  }

  return decrypt(account.accessToken);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const accessToken = await getOneDriveAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });

    const folderId = req.nextUrl.searchParams.get("folderId") || "root";
    const query = req.nextUrl.searchParams.get("q") || undefined;

    const files = await listOneDriveFiles(accessToken, folderId, query);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("OneDrive files error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const accessToken = await getOneDriveAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const { fileId } = await req.json();
    await deleteOneDriveFile(accessToken, fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("OneDrive delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const accessToken = await getOneDriveAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const { fileId, newName, action, parentId, targetParentId } = await req.json();
    if (action === "duplicate") {
      await duplicateOneDriveFile(accessToken, fileId, newName, parentId || "root");
      return NextResponse.json({ success: true });
    }

    if (action === "move") {
      const file = await moveOneDriveFile(accessToken, fileId, targetParentId || "root");
      return NextResponse.json({ file });
    }

    const file = await renameOneDriveFile(accessToken, fileId, newName);
    return NextResponse.json({ file });
  } catch (error) {
    console.error("OneDrive rename error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const accessToken = await getOneDriveAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const { name, parentId } = await req.json();
    const folder = await createOneDriveFolder(accessToken, name, parentId || "root");
    return NextResponse.json({ folder });
  } catch (error) {
    console.error("OneDrive create folder error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
