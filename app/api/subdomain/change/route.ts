import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const newSubdomain = await req.json();
    
    // Validation
    if (!newSubdomain || typeof newSubdomain !== "string") {
      return NextResponse.json({ error: "Invalid subdomain" }, { status: 400 });
    }

    const formatted = newSubdomain.toLowerCase().trim();
    if (formatted.length < 3 || formatted.length > 20) {
      return NextResponse.json({ error: "Must be 3-20 characters" }, { status: 400 });
    }

    if (!/^[a-z0-9-]+$/.test(formatted)) {
      return NextResponse.json({ error: "Alphanumeric and hyphens only" }, { status: 400 });
    }

    const reserved = ["www", "admin", "api", "app", "mail", "oneflash", "help", "support", "guest"];
    if (reserved.includes(formatted)) {
      return NextResponse.json({ error: "Subdomain is reserved" }, { status: 400 });
    }

    // Check availability
    const existing = await prisma.user.findUnique({
      where: { username: formatted },
    });

    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
    }

    // Update
    await prisma.user.update({
      where: { id: user.id },
      data: { username: formatted },
    });

    return NextResponse.json({ success: true, subdomain: formatted });
  } catch (error) {
    console.error("Subdomain change error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
