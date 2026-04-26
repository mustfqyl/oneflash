import { describe, expect, it } from "vitest";
import {
  getGoogleDriveBrowserOpenUrl,
  getGoogleDriveDirectUrl,
} from "@/lib/google-drive";

describe("getGoogleDriveDirectUrl", () => {
  it("returns a browser-direct URL for blob files", () => {
    expect(
      getGoogleDriveDirectUrl({
        mimeType: "video/mp4",
        webContentLink: "https://drive.google.com/blob-download",
      })
    ).toBe("https://drive.google.com/blob-download");
  });

  it("does not expose direct blob URLs for Google Workspace docs in file listings", () => {
    expect(
      getGoogleDriveDirectUrl({
        mimeType: "application/vnd.google-apps.document",
        webContentLink: "https://drive.google.com/blob-download",
      })
    ).toBeNull();
  });
});

describe("getGoogleDriveBrowserOpenUrl", () => {
  it("uses export links when a browser-safe export mime type is requested", () => {
    expect(
      getGoogleDriveBrowserOpenUrl(
        {
          webContentLink: "https://drive.google.com/blob-download",
          exportLinks: {
            "application/pdf": "https://docs.google.com/export-as-pdf",
          },
        },
        "application/pdf"
      )
    ).toBe("https://docs.google.com/export-as-pdf");
  });

  it("falls back to the blob web content link when no export mime type is needed", () => {
    expect(
      getGoogleDriveBrowserOpenUrl({
        webContentLink: "https://drive.google.com/blob-download",
      })
    ).toBe("https://drive.google.com/blob-download");
  });
});
