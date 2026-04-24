import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTrustedOrigin } from "@/lib/security";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deleted = await prisma.guestLink.deleteMany({
      where: {
        token,
        userId: user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Guest link not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete guest link error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
