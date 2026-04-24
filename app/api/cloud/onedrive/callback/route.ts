import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MAX_CLOUD_ACCOUNTS_PER_PROVIDER } from "@/lib/cloud-accounts";
import { prisma } from "@/lib/prisma";
import {
  exchangeOneDriveCode,
  getOneDriveAccountEmail,
} from "@/lib/onedrive";
import { encrypt } from "@/lib/encryption";
import { getAppBaseUrl } from "@/lib/app-url";
import { clearOAuthState, hasValidOAuthState } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);
  const redirectToSettings = (path: string) => {
    const response = NextResponse.redirect(new URL(path, baseUrl));
    return clearOAuthState(response, "onedrive");
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return redirectToSettings("/login");
    }

    if (!hasValidOAuthState(req, "onedrive")) {
      return redirectToSettings("/settings/connections?error=invalid_state");
    }

    if (req.nextUrl.searchParams.get("error")) {
      return redirectToSettings("/settings/connections?error=onedrive_denied");
    }

    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return redirectToSettings("/settings/connections?error=no_code");
    }

    const redirectUri = `${baseUrl}/api/cloud/onedrive/callback`;
    const tokens = await exchangeOneDriveCode(code, redirectUri);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
      },
    });

    if (!user) {
      return redirectToSettings("/login");
    }

    const email = (await getOneDriveAccountEmail(tokens.access_token)) || null;
    const existingAccounts = await prisma.cloudAccount.findMany({
      where: {
        userId: user.id,
        provider: "ONEDRIVE",
      },
      select: {
        id: true,
        email: true,
        refreshToken: true,
      },
    });
    const existingAccount =
      existingAccounts.find((account) => email && account.email === email) ?? null;

    if (!existingAccount && existingAccounts.length >= MAX_CLOUD_ACCOUNTS_PER_PROVIDER) {
      return redirectToSettings("/settings/connections?error=onedrive_limit");
    }

    const refreshToken =
      (typeof tokens.refresh_token === "string" && tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : existingAccount?.refreshToken) ?? null;
    if (!refreshToken) {
      return redirectToSettings("/settings/connections?error=onedrive_refresh_missing");
    }

    const payload = {
      accessToken: encrypt(tokens.access_token),
      refreshToken,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      email,
    };

    if (existingAccount) {
      await prisma.cloudAccount.update({
        where: { id: existingAccount.id },
        data: payload,
      });
    } else {
      await prisma.cloudAccount.create({
        data: {
          userId: user.id,
          provider: "ONEDRIVE",
          ...payload,
        },
      });
    }

    return redirectToSettings("/settings/connections?success=onedrive");
  } catch (error) {
    console.error("OneDrive callback error:", error);
    return redirectToSettings("/settings/connections?error=failed");
  }
}
