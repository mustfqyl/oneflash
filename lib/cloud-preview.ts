import { getScopedCloudAccountId } from "@/lib/cloud-item-id";
import { GOOGLE_PREVIEW_EXPORTS } from "@/lib/google-drive";

export const CLOUD_BROWSER_MEDIA_PREFIX = "/__oneflash/media";
export const CLOUD_PREVIEW_SW_PATH = "/oneflash-cloud-sw.js";
export const CLOUD_PREVIEW_SW_READY_EVENT = "oneflash-cloud-preview-ready";

export function getGooglePreviewMimeType(mimeType: string) {
  return GOOGLE_PREVIEW_EXPORTS[mimeType]?.mimeType || null;
}

export function buildGoogleBrowserPreviewUrl({
  fileId,
  accountId,
  mimeType,
}: {
  fileId: string;
  accountId?: string | null;
  mimeType: string;
}) {
  const resolvedAccountId = accountId || getScopedCloudAccountId(fileId);
  if (!fileId || !resolvedAccountId) {
    return null;
  }

  const params = new URLSearchParams({
    fileId,
    accountId: resolvedAccountId,
  });
  const previewMimeType = getGooglePreviewMimeType(mimeType);

  if (previewMimeType) {
    params.set("exportMimeType", previewMimeType);
  }

  return `${CLOUD_BROWSER_MEDIA_PREFIX}/google?${params.toString()}`;
}

export function requiresCloudPreviewServiceWorker(url: string | null | undefined) {
  return Boolean(url && url.startsWith(`${CLOUD_BROWSER_MEDIA_PREFIX}/`));
}

export function isOffloadedPreviewUrl(url: string | null | undefined) {
  return Boolean(
    url &&
      (requiresCloudPreviewServiceWorker(url) || /^https?:\/\//i.test(url))
  );
}
