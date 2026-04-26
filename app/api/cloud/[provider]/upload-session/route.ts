import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccess } from "@/lib/auth";
import {
  getCloudAccessToken,
  getScopedCloudAccountId,
  getScopedCloudRemoteId,
  resolveCloudAccount,
} from "@/lib/cloud-accounts";
import { createGoogleResumableUploadSession } from "@/lib/google-drive";
import { createOneDriveUploadSession } from "@/lib/onedrive";
import {
  checkRateLimit,
  createRateLimitResponse,
  ensureTrustedOrigin,
  getClientIp,
} from "@/lib/security";
import { getItemNameValidationError } from "@/lib/validation";

type UploadSessionRequestItem = {
  name?: string;
  mimeType?: string;
  folderId?: string;
  accountId?: string;
};

const MAX_UPLOAD_SESSION_BATCH_SIZE = 12;
const MAX_UPLOAD_SESSION_CREATION_CONCURRENCY = 4;

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<TResult>
) {
  const workerCount = Math.min(Math.max(limit, 1), items.length);
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapper(items[currentIndex] as T, currentIndex);
      }
    })
  );

  return results;
}

function isUploadSessionBatchRequest(
  value: unknown
): value is { files: UploadSessionRequestItem[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "files" in value &&
    Array.isArray((value as { files?: unknown }).files)
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const trustedOriginError = ensureTrustedOrigin(req);
    if (trustedOriginError) {
      return trustedOriginError;
    }

    const { access } = await resolveRequestAccess(req, {
      allowTrustedDevice: true,
    });
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit({
      key: `cloud-upload-session:${access.user.id}:${getClientIp(req.headers)}`,
      limit: 90,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        "Too many upload sessions were requested at once. Please retry shortly."
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    let batchRequest = false;
    let rawRequests: UploadSessionRequestItem[];

    if (isUploadSessionBatchRequest(body)) {
      batchRequest = true;
      rawRequests = body.files;
    } else if (typeof body === "object" && body !== null) {
      rawRequests = [body as UploadSessionRequestItem];
    } else {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (rawRequests.length === 0) {
      return NextResponse.json({ error: "No upload session requests were provided" }, { status: 400 });
    }

    if (rawRequests.length > MAX_UPLOAD_SESSION_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `Too many files were requested at once. Reduce the batch to ${MAX_UPLOAD_SESSION_BATCH_SIZE} files or fewer.`,
        },
        { status: 400 }
      );
    }

    const normalizedRequests = rawRequests.map((entry: UploadSessionRequestItem) => {
      const targetFolderId =
        typeof entry?.folderId === "string" && entry.folderId.trim().length > 0
          ? entry.folderId
          : "root";
      const requestedAccountId =
        typeof entry?.accountId === "string" && entry.accountId.trim().length > 0
          ? entry.accountId
          : getScopedCloudAccountId(targetFolderId);

      return {
        name: entry?.name,
        mimeType: entry?.mimeType,
        requestedAccountId,
        remoteFolderId: getScopedCloudRemoteId(targetFolderId) || "root",
      };
    });

    for (const requestItem of normalizedRequests) {
      if (!requestItem.name || typeof requestItem.name !== "string") {
        return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
      }

      const nameError = getItemNameValidationError(requestItem.name, "File name");
      if (nameError) {
        return NextResponse.json({ error: nameError }, { status: 400 });
      }
    }

    const { provider } = await params;

    if (provider !== "google" && provider !== "onedrive") {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const disconnectedMessage =
      provider === "google" ? "Google Drive not connected" : "OneDrive not connected";
    const accountContextCache = new Map<
      string,
      Promise<{
        accessToken: string;
      }>
    >();

    const resolveAccountContext = async (requestedAccountId?: string | null) => {
      const cacheKey = requestedAccountId || "__default__";
      const existingPromise = accountContextCache.get(cacheKey);
      if (existingPromise) {
        return existingPromise;
      }

      const nextPromise = (async () => {
        const { account } = await resolveCloudAccount(
          access.user.id,
          provider,
          requestedAccountId
        );
        if (!account) {
          throw new Error(disconnectedMessage);
        }

        return {
          accessToken: await getCloudAccessToken(account),
        };
      })();
      accountContextCache.set(cacheKey, nextPromise);
      return nextPromise;
    };

    const sessions = await mapWithConcurrency(
      normalizedRequests,
      MAX_UPLOAD_SESSION_CREATION_CONCURRENCY,
      async (requestItem) => {
        const { accessToken } = await resolveAccountContext(
          requestItem.requestedAccountId
        );

        if (provider === "google") {
          return createGoogleResumableUploadSession(accessToken, {
            name: requestItem.name as string,
            mimeType: requestItem.mimeType || "application/octet-stream",
            parentId: requestItem.remoteFolderId,
          });
        }

        return createOneDriveUploadSession(accessToken, {
          name: requestItem.name as string,
          parentId: requestItem.remoteFolderId,
        });
      }
    );

    if (batchRequest) {
      return NextResponse.json({ sessions });
    }

    return NextResponse.json(sessions[0]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Select a connected account first"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error) {
      if (
        error.message === "Google Drive not connected" ||
        error.message === "OneDrive not connected"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Create upload session error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
