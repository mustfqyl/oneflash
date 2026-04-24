import { NextRequest, NextResponse } from "next/server";
import { getSubdomainFromHost, getRootDomain, RESERVED_SUBDOMAINS } from "@/lib/subdomain";

export function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const rootDomain = getRootDomain();
  const subdomain = getSubdomainFromHost(host, rootDomain);

  if (!subdomain || RESERVED_SUBDOMAINS.includes(subdomain as (typeof RESERVED_SUBDOMAINS)[number])) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  res.headers.set("x-subdomain", subdomain);
  return res;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
