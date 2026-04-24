import type { NextRequest } from "next/server";
import { getRootDomain } from "@/lib/subdomain";

type UrlInput = NextRequest | URL | string | null | undefined;

function toOrigin(value: UrlInput) {
  if (!value) {
    return null;
  }

  try {
    if (typeof value === "string") {
      return new URL(value).origin;
    }

    if (value instanceof URL) {
      return value.origin;
    }

    return value.nextUrl.origin;
  } catch {
    return null;
  }
}

export function getAppBaseUrl(request?: UrlInput) {
  return (
    toOrigin(process.env.NEXTAUTH_URL) ||
    toOrigin(request) ||
    (process.env.NODE_ENV === "production"
      ? `https://${getRootDomain()}`
      : "http://localhost:3000")
  );
}
