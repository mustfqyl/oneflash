import { randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

type OAuthProvider = "google" | "onedrive";

function getCookieName(provider: OAuthProvider) {
  return `oneflash_oauth_${provider}_state`;
}

function getCookiePath(provider: OAuthProvider) {
  return `/api/cloud/${provider}/callback`;
}

export function issueOAuthState(
  response: NextResponse,
  provider: OAuthProvider
) {
  const state = randomBytes(24).toString("base64url");

  response.cookies.set(getCookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: getCookiePath(provider),
  });

  return state;
}

export function clearOAuthState(
  response: NextResponse,
  provider: OAuthProvider
) {
  response.cookies.set(getCookieName(provider), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: getCookiePath(provider),
  });

  return response;
}

export function hasValidOAuthState(
  req: NextRequest,
  provider: OAuthProvider
) {
  const expectedState = req.cookies.get(getCookieName(provider))?.value;
  const receivedState = req.nextUrl.searchParams.get("state");

  if (!expectedState || !receivedState) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedState);
  const receivedBuffer = Buffer.from(receivedState);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
