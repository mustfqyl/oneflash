import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { exchangeOneDriveCode } from "@/lib/onedrive";
import { encrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL("/settings/connections?error=no_code", req.url));
    }

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/cloud/onedrive/callback`;
    const tokens = await exchangeOneDriveCode(code, redirectUri);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Get Microsoft account email
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const email = profile.userPrincipalName || profile.mail || "Unknown";

    await prisma.cloudAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: "ONEDRIVE" } },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        email,
      },
      create: {
        userId: user.id,
        provider: "ONEDRIVE",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        email,
      },
    });

    return NextResponse.redirect(new URL("/settings/connections?success=onedrive", req.url));
  } catch (error) {
    console.error("OneDrive callback error:", error);
    return NextResponse.redirect(new URL("/settings/connections?error=failed", req.url));
  }
}
