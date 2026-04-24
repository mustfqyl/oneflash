import type { CloudAccount, Provider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import { refreshGoogleToken } from "@/lib/google-drive";
import { refreshOneDriveToken } from "@/lib/onedrive";

export {
  decodeScopedCloudItemId,
  encodeScopedCloudItemId,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
} from "@/lib/cloud-item-id";

export type CloudProviderId = "google" | "onedrive";

export const MAX_CLOUD_ACCOUNTS_PER_PROVIDER = 5;

const PROVIDER_MAP: Record<CloudProviderId, Provider> = {
  google: "GOOGLE_DRIVE",
  onedrive: "ONEDRIVE",
};

export function getProviderEnum(provider: CloudProviderId): Provider {
  return PROVIDER_MAP[provider];
}

export async function listCloudAccounts(
  userId: string,
  provider: CloudProviderId
) {
  return prisma.cloudAccount.findMany({
    where: {
      userId,
      provider: getProviderEnum(provider),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function resolveCloudAccount(
  userId: string,
  provider: CloudProviderId,
  requestedAccountId?: string | null
) {
  const accounts = await listCloudAccounts(userId, provider);

  if (accounts.length === 0) {
    return { account: null, accounts };
  }

  if (requestedAccountId) {
    const account = accounts.find((entry) => entry.id === requestedAccountId) ?? null;
    return { account, accounts };
  }

  if (accounts.length === 1) {
    return { account: accounts[0] ?? null, accounts };
  }

  throw new Error("Select a connected account first");
}

export async function getCloudAccessToken(
  account: Pick<
    CloudAccount,
    "id" | "provider" | "accessToken" | "refreshToken" | "expiresAt"
  >
): Promise<string> {
  if (!account.expiresAt || account.expiresAt > new Date()) {
    return decrypt(account.accessToken);
  }

  if (account.provider === "GOOGLE_DRIVE") {
    const { access_token, expires_in } = await refreshGoogleToken(account.refreshToken);
    await prisma.cloudAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(access_token),
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });
    return access_token;
  }

  if (account.provider === "ONEDRIVE") {
    const { access_token, refresh_token, expires_in } = await refreshOneDriveToken(
      account.refreshToken
    );
    await prisma.cloudAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(access_token),
        refreshToken: encrypt(refresh_token),
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });
    return access_token;
  }

  return decrypt(account.accessToken);
}
