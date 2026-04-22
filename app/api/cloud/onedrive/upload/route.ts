import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import { uploadToOneDrive, refreshOneDriveToken } from "@/lib/onedrive";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const account = await prisma.cloudAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider: "ONEDRIVE" } },
    });
    if (!account) {
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }

    let accessToken = decrypt(account.accessToken);

    // Refresh if expired
    if (account.expiresAt && account.expiresAt < new Date()) {
      const refreshed = await refreshOneDriveToken(account.refreshToken);
      accessToken = refreshed.access_token;
      await prisma.cloudAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(accessToken),
          refreshToken: encrypt(refreshed.refresh_token),
          expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderId = (formData.get("folderId") as string) || "root";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await uploadToOneDrive(accessToken, buffer, file.name, folderId);

    return NextResponse.json({ file: result });
  } catch (error) {
    console.error("OneDrive upload error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
