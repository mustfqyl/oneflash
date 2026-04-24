import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getProviderEnum,
  type CloudProviderId,
} from "@/lib/cloud-accounts";
import { prisma } from "@/lib/prisma";
import { ensureTrustedOrigin } from "@/lib/security";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> }
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

    const { provider } = await context.params;
    if (provider !== "google" && provider !== "onedrive") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }
    const accountId = (await req.json().catch(() => null)) as
      | { accountId?: string }
      | null;

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
        provider: getProviderEnum(provider as CloudProviderId),
        ...(accountId?.accountId ? { id: accountId.accountId } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cloud disconnect error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
