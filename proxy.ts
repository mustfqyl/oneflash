import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const subdomain = host.split(".")[0];
  const reserved = ["www", "admin", "api", "app", "mail", "oneflash", "help", "support", "guest"];

  // If it's a reserved subdomain or the main domain, pass through
  if (reserved.includes(subdomain) || !host.includes(".")) {
    return NextResponse.next();
  }

  const trustedToken = req.cookies.get("trusted_device")?.value;
  const res = NextResponse.next();
  res.headers.set("x-subdomain", subdomain);
  if (trustedToken) {
    res.headers.set("x-trusted-token", trustedToken);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
