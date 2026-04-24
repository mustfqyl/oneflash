import { NextRequest, NextResponse } from "next/server";
import { getSubdomainFromHost, getRootDomain, RESERVED_SUBDOMAINS } from "@/lib/subdomain";
import { prisma } from "@/lib/prisma";

export async function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const rootDomain = getRootDomain();
  const subdomain = getSubdomainFromHost(host, rootDomain);

  if (!subdomain || RESERVED_SUBDOMAINS.includes(subdomain as (typeof RESERVED_SUBDOMAINS)[number])) {
    return NextResponse.next();
  }

  // Subdomain'den kullanıcıyı DB'den bul
  try {
    const user = await prisma.user.findUnique({
      where: { customDomain: subdomain },
      select: { username: true }
    });

    if (user) {
      // İlgili kullanıcının dosya yöneticisi sayfasına yönlendir
      const res = NextResponse.rewrite(new URL('/files', req.url));
      res.headers.set("x-subdomain", subdomain);
      return res;
    }
  } catch (error) {
    console.error("Proxy DB Error:", error);
  }

  const res = NextResponse.next();
  res.headers.set("x-subdomain", subdomain);
  return res;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
