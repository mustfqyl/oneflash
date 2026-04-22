import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.guestLink.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    return NextResponse.json({ link: `${process.env.NEXTAUTH_URL}/guest/${token}` });
  } catch (error) {
    console.error("Create guest link error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const links = await prisma.guestLink.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error("List guest links error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
