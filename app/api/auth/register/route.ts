import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/pin";
import bcrypt from "bcryptjs";
import {
  checkRateLimit,
  createRateLimitResponse,
  ensureTrustedOrigin,
  getClientIp,
} from "@/lib/security";
import {
  getPasswordValidationError,
  isValidSixDigitPin,
  normalizeEmail,
  getUsernameValidationError,
} from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const { username, email, password, pin } = (await req.json()) as {
      username?: string;
      email?: string;
      password?: string;
      pin?: string;
    };
    const normalizedUsername =
      typeof username === "string" ? username.trim().toLowerCase() : "";
    const normalizedEmail = typeof email === "string" ? normalizeEmail(email) : "";
    const passwordValue = typeof password === "string" ? password : "";
    const pinValue = typeof pin === "string" ? pin : "";

    if (!normalizedUsername || !normalizedEmail || !passwordValue || !pinValue) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const usernameError = getUsernameValidationError(normalizedUsername);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = getPasswordValidationError(passwordValue);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (!isValidSixDigitPin(pinValue)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
    }

    const rateLimit = checkRateLimit({
      key: `register:${getClientIp(req.headers)}:${normalizedEmail}:${normalizedUsername}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many signup attempts. Please wait before trying again."
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(passwordValue, 12);
    const hashedPin = await hashPin(pinValue);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        pin: hashedPin,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
