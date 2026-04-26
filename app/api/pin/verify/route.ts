import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin, checkLockout, recordFailedAttempt, resetLockout } from "@/lib/pin";
import { getGeoFromIP } from "@/lib/geo";
import { sendLoginNotification } from "@/lib/email";
import { createHash, randomBytes } from "crypto";
import {
  checkRateLimit,
  createRateLimitResponse,
  ensureTrustedOrigin,
  getClientIp,
} from "@/lib/security";
import { isValidSixDigitPin } from "@/lib/validation";
import { normalizeSubdomain } from "@/lib/subdomain";

function hashTrustedDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const { pin, subdomain, trustDevice } = (await req.json()) as {
      pin?: string;
      subdomain?: string;
      trustDevice?: boolean;
    };
    const normalizedSubdomain =
      typeof subdomain === "string" ? normalizeSubdomain(subdomain) : "";
    const pinValue = typeof pin === "string" ? pin : "";

    if (!pinValue || !normalizedSubdomain) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!isValidSixDigitPin(pinValue)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
    }

    const rateLimit = checkRateLimit({
      key: `pin:${normalizedSubdomain}:${getClientIp(req.headers)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many PIN attempts. Please wait before trying again."
      );
    }

    // Find user by customDomain (subdomain)
    const user = await prisma.user.findUnique({
      where: { customDomain: normalizedSubdomain },
      select: {
        id: true,
        email: true,
        pin: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check lockout
    const lockout = checkLockout(user.id);
    if (lockout.locked) {
      return NextResponse.json(
        { error: "Too many attempts", remainingMs: lockout.remainingMs },
        { status: 429 }
      );
    }

    // Verify PIN
    const isValid = await verifyPin(pinValue, user.pin);
    if (!isValid) {
      const result = recordFailedAttempt(user.id);
      return NextResponse.json(
        {
          error: "Invalid PIN",
          locked: result.locked,
          remainingMs: result.remainingMs,
        },
        { status: 401 }
      );
    }

    // PIN is valid — reset lockout
    resetLockout(user.id);

    // Get IP and geo
    const ip = getClientIp(req.headers);
    const device = req.headers.get("user-agent") || "Unknown";
    const geo = await getGeoFromIP(ip, req.headers);

    // Log access
    await prisma.accessLog.create({
      data: {
        userId: user.id,
        ip,
        country: geo.country,
        city: geo.city,
        device,
      },
    });

    // Send login notification email (fire and forget)
    sendLoginNotification({
      to: user.email,
      ip,
      country: geo.country,
      city: geo.city,
      device,
      time: new Date(),
    }).catch(console.error);

    const response = NextResponse.json({ success: true, userId: user.id });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + ((trustDevice === true) ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000)
    );

    await prisma.trustedDevice.create({
      data: {
        userId: user.id,
        token: hashTrustedDeviceToken(token),
        deviceName: device,
        expiresAt,
      },
    });

    response.cookies.set("trusted_device", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      ...(trustDevice === true ? { expires: expiresAt } : {}),
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("PIN verify error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
