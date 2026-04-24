import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPin, hashPin } from "@/lib/pin";
import {
  checkRateLimit,
  createRateLimitResponse,
  ensureTrustedOrigin,
} from "@/lib/security";
import { isValidSixDigitPin } from "@/lib/validation";

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

    const { newPin } = await req.json();

    const rateLimit = checkRateLimit({
      key: `settings-pin:${session.user.email}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many PIN change attempts. Please wait before trying again."
      );
    }

    if (
      typeof newPin !== "string" ||
      !isValidSixDigitPin(newPin)
    ) {
      return NextResponse.json(
        { error: "PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }



    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        pin: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSamePin = await verifyPin(newPin, user.pin);
    if (isSamePin) {
      return NextResponse.json({ error: "New PIN must be different from the current PIN" }, { status: 400 });
    }

    const hashedPin = await hashPin(newPin);
    await prisma.user.update({
      where: { id: user.id },
      data: { pin: hashedPin },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PIN change error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
