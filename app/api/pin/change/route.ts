import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { verifyPin, hashPin } from "@/lib/pin";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPin, newPin } = await req.json();

    if (!currentPin || !newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPin(currentPin, user.pin);
    if (!isValid) {
      return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
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
