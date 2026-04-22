import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/pin";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { username, email, password, pin } = await req.json();

    if (!username || !email || !password || !pin) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (username.length < 3 || username.length > 20 || !/^[a-z0-9-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Subdomain must be 3-20 lowercase alphanumeric characters or hyphens" },
        { status: 400 }
      );
    }

    const reserved = ["www", "admin", "api", "app", "mail", "oneflash", "help", "support", "guest"];
    if (reserved.includes(username)) {
      return NextResponse.json({ error: "Subdomain is reserved" }, { status: 400 });
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const hashedPin = await hashPin(pin);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        pin: hashedPin,
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
