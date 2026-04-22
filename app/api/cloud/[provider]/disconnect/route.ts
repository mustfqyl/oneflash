import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import type { Provider } from "@prisma/client";

const providerMap: Record<string, Provider> = {
  google: "GOOGLE_DRIVE",
  onedrive: "ONEDRIVE",
};

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await context.params;
    const mappedProvider = providerMap[provider];
    if (!mappedProvider) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.cloudAccount.deleteMany({
      where: {
        userId: user.id,
        provider: mappedProvider,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cloud disconnect error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
