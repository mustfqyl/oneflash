import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";
import StatusBar from "@/components/finder/StatusBar";

function buildCloudState(overrides: Record<string, unknown> = {}) {
  return {
    files: [
      {
        id: "file-1",
        name: "Notes.txt",
      },
    ],
    selection: [],
    searchQuery: "",
    folderNames: { root: "oneflash.one" },
    currentFolderId: "root",
    uploadState: {
      active: false,
      status: "idle",
      provider: null,
      fileCount: 0,
      currentFileName: null,
      uploadedBytes: 0,
      totalBytes: 0,
      progress: 0,
      speedBytesPerSecond: 0,
      remainingSeconds: null,
    },
    pauseUploads: vi.fn(),
    resumeUploads: vi.fn(),
    cancelUploads: vi.fn(),
    ...overrides,
  };
}

describe("StatusBar", () => {
  it("shows selection count when there is no active upload", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        selection: ["file-1", "file-2"],
      })
    );

    render(<StatusBar />);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("shows live upload info and controls", async () => {
    const pauseUploads = vi.fn();
    const cancelUploads = vi.fn();

    mockUseCloud.mockReturnValue(
      buildCloudState({
        uploadState: {
          active: true,
          status: "running",
          provider: "google",
          fileCount: 2,
          currentFileName: "Archive.zip",
          uploadedBytes: 50,
          totalBytes: 100,
          progress: 50,
          speedBytesPerSecond: 10 * 1024 * 1024,
          remainingSeconds: 5,
        },
        pauseUploads,
        cancelUploads,
      })
    );

    render(<StatusBar />);

    expect(screen.getByText(/Uploading 2 files/i)).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("50 B / 100 B")).toBeInTheDocument();
    expect(screen.getByText(/10 MB\/s/i)).toBeInTheDocument();
    expect(screen.getByText("5s left")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(pauseUploads).toHaveBeenCalledTimes(1);
    expect(cancelUploads).toHaveBeenCalledTimes(1);
  });

  it("shows upload byte progress even before transfer speed is known", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        uploadState: {
          active: true,
          status: "running",
          provider: "google",
          fileCount: 1,
          currentFileName: "Photo.jpg",
          uploadedBytes: 2048,
          totalBytes: 8192,
          progress: 25,
          speedBytesPerSecond: 0,
          remainingSeconds: null,
        },
      })
    );

    render(<StatusBar />);

    expect(screen.getByText("2.0 KB / 8.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Preparing...")).toBeInTheDocument();
    expect(screen.getByText("Estimating...")).toBeInTheDocument();
  });
});
