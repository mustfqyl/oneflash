import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin, checkLockout, recordFailedAttempt, resetLockout } from "@/lib/pin";
import { getGeoFromIP } from "@/lib/geo";
import { sendLoginNotification } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { pin, subdomain, trustDevice } = await req.json();

    if (!pin || !subdomain) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Find user by username (subdomain)
    const user = await prisma.user.findUnique({
      where: { username: subdomain },
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
    const isValid = await verifyPin(pin, user.pin);
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
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const device = req.headers.get("user-agent") || "Unknown";
    const geo = await getGeoFromIP(ip);

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

    // Set trusted device cookie if requested
    if (trustDevice) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await prisma.trustedDevice.create({
        data: {
          userId: user.id,
          token,
          deviceName: device,
          expiresAt,
        },
      });

      response.cookies.set("trusted_device", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("PIN verify error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
