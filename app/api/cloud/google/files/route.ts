import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  listGoogleDriveFiles,
  deleteGoogleDriveFile,
  renameGoogleDriveFile,
  createGoogleDriveFolder,
  duplicateGoogleDriveFile,
  moveGoogleDriveFile,
  refreshGoogleToken,
} from "@/lib/google-drive";
import { encrypt } from "@/lib/encryption";

async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.cloudAccount.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_DRIVE" } },
  });
  if (!account) return null;

  // Check if token is expired
  if (account.expiresAt && account.expiresAt < new Date()) {
    const { access_token, expires_in } = await refreshGoogleToken(account.refreshToken);
    await prisma.cloudAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(access_token),
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
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accessToken = await getGoogleAccessToken(user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 });
    }

    const folderId = req.nextUrl.searchParams.get("folderId") || "root";
    const query = req.nextUrl.searchParams.get("q") || undefined;

    const files = await listGoogleDriveFiles(accessToken, folderId, query);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Google files error:", error);
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

    const accessToken = await getGoogleAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const { fileId } = await req.json();
    await deleteGoogleDriveFile(accessToken, fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Google delete error:", error);
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

    const accessToken = await getGoogleAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const { fileId, newName, action, parentId, sourceParentId, targetParentId } = await req.json();
    if (action === "duplicate") {
      const file = await duplicateGoogleDriveFile(
        accessToken,
        fileId,
        newName,
        parentId || "root"
      );
      return NextResponse.json({ file });
    }

    if (action === "move") {
      const file = await moveGoogleDriveFile(
        accessToken,
        fileId,
        sourceParentId || "root",
        targetParentId || "root"
      );
      return NextResponse.json({ file });
    }

    const file = await renameGoogleDriveFile(accessToken, fileId, newName);
    return NextResponse.json({ file });
  } catch (error) {
    console.error("Google rename error:", error);
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

    const accessToken = await getGoogleAccessToken(user.id);
    if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const { name, parentId } = await req.json();
    const folder = await createGoogleDriveFolder(accessToken, name, parentId || "root");
    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Google create folder error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
