import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { exchangeGoogleCode } from "@/lib/google-drive";
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

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/cloud/google/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Get Google account email
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const profile = await profileRes.json();

    await prisma.cloudAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: "GOOGLE_DRIVE" } },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        email: profile.email,
      },
      create: {
        userId: user.id,
        provider: "GOOGLE_DRIVE",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        email: profile.email,
      },
    });

    return NextResponse.redirect(new URL("/settings/connections?success=google", req.url));
  } catch (error) {
    console.error("Google callback error:", error);
    return NextResponse.redirect(new URL("/settings/connections?error=failed", req.url));
  }
}
