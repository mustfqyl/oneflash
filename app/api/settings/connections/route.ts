import { NextResponse } from "next/server";
import { resolveServerAccess } from "@/lib/auth";
import {
  getCloudAccessToken,
  MAX_CLOUD_ACCOUNTS_PER_PROVIDER,
} from "@/lib/cloud-accounts";
import {
  getGoogleDriveAccountEmail,
  getGoogleDriveStorageQuota,
} from "@/lib/google-drive";
import {
  getOneDriveAccountEmail,
  getOneDriveStorageQuota,
} from "@/lib/onedrive";
import { prisma } from "@/lib/prisma";

type CloudProvider = "GOOGLE_DRIVE" | "ONEDRIVE";

type CloudAccountRecord = {
  id: string;
  provider: CloudProvider;
  email: string | null;
  createdAt: Date;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
};

type HydratedCloudAccount = CloudAccountRecord & {
  storage: {
    usedBytes: number | null;
    totalBytes: number | null;
    remainingBytes: number | null;
  } | null;
};

async function hydrateAccount(account: CloudAccountRecord): Promise<HydratedCloudAccount> {
  let email = account.email;
  let storage: HydratedCloudAccount["storage"] = null;

  try {
    const accessToken = await getCloudAccessToken(account);

    if (!email) {
      const hydratedEmail =
        account.provider === "GOOGLE_DRIVE"
          ? await getGoogleDriveAccountEmail(accessToken)
          : await getOneDriveAccountEmail(accessToken);

      if (hydratedEmail) {
        email = hydratedEmail;
        await prisma.cloudAccount.update({
          where: { id: account.id },
          data: { email: hydratedEmail },
        });
      }
    }

    if (account.provider === "GOOGLE_DRIVE") {
      const quota = await getGoogleDriveStorageQuota(accessToken);
      if (quota) {
        storage = {
          usedBytes: quota.usage,
          totalBytes: quota.limit,
          remainingBytes:
            quota.limit !== null && quota.usage !== null
              ? Math.max(quota.limit - quota.usage, 0)
              : null,
        };
      }
    } else {
      const quota = await getOneDriveStorageQuota(accessToken);
      if (quota) {
        storage = {
          usedBytes: quota.used,
          totalBytes: quota.total,
          remainingBytes:
            quota.remaining ??
            (quota.total !== null && quota.used !== null
              ? Math.max(quota.total - quota.used, 0)
              : null),
        };
      }
    }
  } catch {
    // Keep the settings page usable even if one provider's metadata call fails.
  }

  return {
    ...account,
    email,
    storage,
  };
}

export async function GET() {
  try {
    const { access } = await resolveServerAccess({
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: access.user.id },
      include: {
        cloudAccounts: {
          select: {
            id: true,
            provider: true,
            email: true,
            createdAt: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hydratedAccounts = await Promise.all(
      (
        user.cloudAccounts as Array<{
          id: string;
          provider: "GOOGLE_DRIVE" | "ONEDRIVE";
          email: string | null;
          createdAt: Date;
          accessToken: string;
          refreshToken: string;
          expiresAt: Date | null;
        }>
      ).map((account) => hydrateAccount(account))
    );

    const googleAccounts = hydratedAccounts
      .filter((acc) => acc.provider === "GOOGLE_DRIVE")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const onedriveAccounts = hydratedAccounts
      .filter((acc) => acc.provider === "ONEDRIVE")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    return NextResponse.json({
      providers: {
        google: {
          connected: googleAccounts.length > 0,
          email: googleAccounts[0]?.email ?? null,
          connectedAt: googleAccounts[0]?.createdAt ?? null,
          accountCount: googleAccounts.length,
          limit: MAX_CLOUD_ACCOUNTS_PER_PROVIDER,
          remainingSlots: Math.max(
            0,
            MAX_CLOUD_ACCOUNTS_PER_PROVIDER - googleAccounts.length
          ),
          accounts: googleAccounts.map((account) => ({
            id: account.id,
            email: account.email ?? null,
            connectedAt: account.createdAt,
            usedBytes: account.storage?.usedBytes ?? null,
            totalBytes: account.storage?.totalBytes ?? null,
            remainingBytes: account.storage?.remainingBytes ?? null,
          })),
        },
        onedrive: {
          connected: onedriveAccounts.length > 0,
          email: onedriveAccounts[0]?.email ?? null,
          connectedAt: onedriveAccounts[0]?.createdAt ?? null,
          accountCount: onedriveAccounts.length,
          limit: MAX_CLOUD_ACCOUNTS_PER_PROVIDER,
          remainingSlots: Math.max(
            0,
            MAX_CLOUD_ACCOUNTS_PER_PROVIDER - onedriveAccounts.length
          ),
          accounts: onedriveAccounts.map((account) => ({
            id: account.id,
            email: account.email ?? null,
            connectedAt: account.createdAt,
            usedBytes: account.storage?.usedBytes ?? null,
            totalBytes: account.storage?.totalBytes ?? null,
            remainingBytes: account.storage?.remainingBytes ?? null,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Connections status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
