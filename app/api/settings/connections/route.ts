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
      include: { cloudAccounts: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const google = user.cloudAccounts.find((acc) => acc.provider === "GOOGLE_DRIVE");
    const onedrive = user.cloudAccounts.find((acc) => acc.provider === "ONEDRIVE");

    return NextResponse.json({
      providers: {
        google: {
          connected: !!google,
          email: google?.email ?? null,
          connectedAt: google?.createdAt ?? null,
        },
        onedrive: {
          connected: !!onedrive,
          email: onedrive?.email ?? null,
          connectedAt: onedrive?.createdAt ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Connections status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
