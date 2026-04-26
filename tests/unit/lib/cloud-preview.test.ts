import { describe, expect, it } from "vitest";
import { encodeScopedCloudItemId } from "@/lib/cloud-item-id";
import {
  buildGoogleBrowserPreviewUrl,
  getGooglePreviewMimeType,
  requiresCloudPreviewServiceWorker,
} from "@/lib/cloud-preview";

describe("buildGoogleBrowserPreviewUrl", () => {
  it("builds a same-origin preview URL for standard Google Drive files", () => {
    const fileId = encodeScopedCloudItemId("google-1", "file-1");

    expect(
      buildGoogleBrowserPreviewUrl({
        fileId,
        mimeType: "video/mp4",
      })
    ).toBe(
      "/__oneflash/media/google?fileId=google-1%3A%3Afile-1&accountId=google-1"
    );
  });

  it("adds an export mime type for Google Workspace previews", () => {
    const fileId = encodeScopedCloudItemId("google-1", "doc-1");

    expect(
      buildGoogleBrowserPreviewUrl({
        fileId,
        mimeType: "application/vnd.google-apps.document",
      })
    ).toBe(
      "/__oneflash/media/google?fileId=google-1%3A%3Adoc-1&accountId=google-1&exportMimeType=application%2Fpdf"
    );
    expect(getGooglePreviewMimeType("application/vnd.google-apps.document")).toBe(
      "application/pdf"
    );
  });
});

describe("requiresCloudPreviewServiceWorker", () => {
  it("detects service-worker-backed preview URLs", () => {
    expect(
      requiresCloudPreviewServiceWorker(
        "/__oneflash/media/google?fileId=google-1%3A%3Afile-1&accountId=google-1"
      )
    ).toBe(true);
    expect(requiresCloudPreviewServiceWorker("https://example.com/video.mp4")).toBe(
      false
    );
  });
});
