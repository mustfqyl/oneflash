import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    await prisma.guestLink.delete({
      where: { token },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete guest link error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
