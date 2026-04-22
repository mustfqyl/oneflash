import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        name: true,
        username: true,
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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
      return NextResponse.json({ error: "Name must be 2-50 characters" }, { status: 400 });
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Me update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
