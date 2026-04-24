import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  MAX_CLOUD_ACCOUNTS_PER_PROVIDER,
  getProviderEnum,
} from "@/lib/cloud-accounts";
import { getOneDriveAuthUrl } from "@/lib/onedrive";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";
import { issueOAuthState } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const accountCount = await prisma.cloudAccount.count({
    where: {
      userId: user.id,
      provider: getProviderEnum("onedrive"),
    },
  });
  if (accountCount >= MAX_CLOUD_ACCOUNTS_PER_PROVIDER) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=onedrive_limit", baseUrl)
    );
  }

  const redirectUri = `${baseUrl}/api/cloud/onedrive/callback`;
  const response = NextResponse.redirect(new URL("/settings/connections", baseUrl));
  const state = issueOAuthState(response, "onedrive");
  response.headers.set("Location", getOneDriveAuthUrl(redirectUri, state));
  return response;
}
