import { describe, expect, it } from "vitest";
import {
  inferExtensionFromMimeType,
  resolveFileMimeType,
} from "@/lib/file-mime";

describe("resolveFileMimeType", () => {
  it("infers a previewable mime type from the file extension when the browser omits it", () => {
    expect(resolveFileMimeType("photo.jpg", "")).toBe("image/jpeg");
    expect(resolveFileMimeType("clip.mp4", "application/octet-stream")).toBe("video/mp4");
  });

  it("overrides zip-like mime types when the file extension clearly points to another format", () => {
    expect(resolveFileMimeType("poster.png", "application/x-zip-compressed")).toBe(
      "image/png"
    );
  });

  it("keeps archive mime types for actual archive files", () => {
    expect(resolveFileMimeType("backup.zip", "application/x-zip-compressed")).toBe(
      "application/x-zip-compressed"
    );
  });

  it("can derive a file extension from a resolved mime type", () => {
    expect(inferExtensionFromMimeType("image/jpeg")).toBe("jpg");
    expect(inferExtensionFromMimeType("video/quicktime")).toBe("mov");
  });
});
