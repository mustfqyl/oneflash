import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import { downloadGoogleDriveFile, refreshGoogleToken } from "@/lib/google-drive";
import { downloadOneDriveFile, refreshOneDriveToken } from "@/lib/onedrive";

async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.cloudAccount.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_DRIVE" } },
  });
  if (!account) return null;

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

async function getOneDriveAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.cloudAccount.findUnique({
    where: { userId_provider: { userId, provider: "ONEDRIVE" } },
  });
  if (!account) return null;

  if (account.expiresAt && account.expiresAt < new Date()) {
    const { access_token, refresh_token, expires_in } = await refreshOneDriveToken(account.refreshToken);
    await prisma.cloudAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(access_token),
        refreshToken: encrypt(refresh_token),
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });
    return access_token;
  }

  return decrypt(account.accessToken);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
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

    const { provider } = await params;
    const fileId = req.nextUrl.searchParams.get("fileId");
    const fileName = req.nextUrl.searchParams.get("name");
    const forceDownload = req.nextUrl.searchParams.get("download") === "1";
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    let upstream: Response;

    if (provider === "google") {
      const accessToken = await getGoogleAccessToken(user.id);
      if (!accessToken) {
        return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 });
      }
      upstream = await downloadGoogleDriveFile(accessToken, fileId);
    } else if (provider === "onedrive") {
      const accessToken = await getOneDriveAccessToken(user.id);
      if (!accessToken) {
        return NextResponse.json({ error: "OneDrive not connected" }, { status: 400 });
      }
      upstream = await downloadOneDriveFile(accessToken, fileId);
    } else {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    if (!upstream.ok) {
      const message = await upstream.text();
      return NextResponse.json(
        { error: message || "Failed to open file" },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", "private, no-store");

    const contentDisposition = upstream.headers.get("Content-Disposition");
    if (contentDisposition) {
      let nextDisposition = forceDownload
        ? contentDisposition.replace("inline", "attachment")
        : contentDisposition.replace("attachment", "inline");

      if (forceDownload && fileName) {
        const encodedName = encodeURIComponent(fileName);
        nextDisposition = `attachment; filename*=UTF-8''${encodedName}`;
      }

      headers.set("Content-Disposition", nextDisposition);
    } else {
      if (forceDownload && fileName) {
        headers.set(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        );
      } else {
        headers.set("Content-Disposition", forceDownload ? "attachment" : "inline");
      }
    }

    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Open file error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
