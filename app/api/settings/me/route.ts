import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  createRateLimitResponse,
  ensureTrustedOrigin,
} from "@/lib/security";
import { getDisplayNameValidationError, getUsernameValidationError } from "@/lib/validation";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        name: true,
        username: true,
        customDomain: true,
        email: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Me fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateLimit = checkRateLimit({
      key: `settings-profile:${session.user.email}`,
      limit: 15,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many profile update attempts. Please wait before trying again."
      );
    }

    const { name, username } = await req.json();

    const dataToUpdate: {
      name?: string;
      username?: string;
    } = {};

    if (typeof name === "string") {
      const nameError = getDisplayNameValidationError(name);
      if (nameError) {
        return NextResponse.json({ error: nameError }, { status: 400 });
      }
      dataToUpdate.name = name.trim();
    }

    if (typeof username === "string") {
      const normalizedUsername = username.trim().toLowerCase();
      const usernameError = getUsernameValidationError(normalizedUsername);
      if (usernameError) {
        return NextResponse.json({ error: usernameError }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({
        where: { username: normalizedUsername },
        select: { id: true },
      });

      if (existing && existing.id !== currentUser.id) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }

      dataToUpdate.username = normalizedUsername;
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data: dataToUpdate,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Me update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
