import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getSubdomainValidationError, normalizeSubdomain } from "@/lib/subdomain";
import {
  checkRateLimit,
  createRateLimitResponse,
  ensureTrustedOrigin,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const rateLimit = checkRateLimit({
      key: `settings-subdomain:${session.user.email}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many subdomain change attempts. Please wait before trying again."
      );
    }

    const newSubdomain = await req.json();
    
    // Validation
    if (!newSubdomain || typeof newSubdomain !== "string") {
      return NextResponse.json({ error: "Invalid subdomain" }, { status: 400 });
    }

    const formatted = normalizeSubdomain(newSubdomain);
    const subdomainError = getSubdomainValidationError(formatted);
    if (subdomainError) {
      return NextResponse.json({ error: subdomainError }, { status: 400 });
    }

    // Check availability
    const existing = await prisma.user.findUnique({
      where: { customDomain: formatted },
      select: {
        id: true,
      },
    });

    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
    }

    // Update
    await prisma.user.update({
      where: { id: user.id },
      data: { customDomain: formatted },
    });

    return NextResponse.json({ success: true, subdomain: formatted });
  } catch (error) {
    console.error("Subdomain change error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
