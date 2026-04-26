import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  getCloudAccessToken,
  getScopedCloudAccountId,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/security";

const BROWSER_TOKEN_TTL_MS = 45 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileId = req.nextUrl.searchParams.get("fileId");
    const requestedAccountId =
      req.nextUrl.searchParams.get("accountId") || getScopedCloudAccountId(fileId);

    if (!requestedAccountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const rateLimit = checkRateLimit({
      key: `google-browser-token:${access.user.id}:${requestedAccountId}:${getClientIp(
        req.headers
      )}`,
      limit: 180,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many preview authorization requests. Please retry shortly."
      );
    }

    const { account } = await resolveCloudAccount(
      access.user.id,
      "google",
      requestedAccountId
    );
    if (!account) {
      return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 });
    }

    const accessToken = await getCloudAccessToken(account);
    const response = NextResponse.json({
      accessToken,
      accountId: account.id,
      expiresAt: Date.now() + BROWSER_TOKEN_TTL_MS,
    });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "same-origin");
    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Google browser token error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
