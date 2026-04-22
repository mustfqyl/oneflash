import { NextResponse } from "next/server";
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
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const logs = await prisma.accessLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Access logs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
