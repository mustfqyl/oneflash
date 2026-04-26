import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";
import FileGrid from "@/components/finder/FileGrid";

vi.mock("next/navigation", () => ({
  usePathname: () => "/files",
}));

afterEach(() => {
  delete (
    window as Window & {
      __oneflashCloudPreviewWorkerReady__?: boolean;
    }
  ).__oneflashCloudPreviewWorkerReady__;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function buildCloudState(overrides: Record<string, unknown> = {}) {
  return {
    provider: "google",
    currentLocationProvider: "google",
    currentLocationAccountId: "google-1",
    files: [
      {
        id: "file-1",
        name: "Notes.txt",
        mimeType: "text/plain",
        isFolder: false,
        provider: "google",
      },
    ],
    loading: false,
    error: "",
    selection: [],
    setSelection: vi.fn(),
    navigateToFolder: vi.fn(),
    clearSelection: vi.fn(),
    searchQuery: "",
    viewMode: "grid",
    itemScale: "comfortable",
    itemDensity: "normal",
    renameFile: vi.fn(),
    duplicateFile: vi.fn(),
    deleteSelected: vi.fn(),
    deleteFiles: vi.fn(),
    createFolder: vi.fn(),
    uploadFiles: vi.fn(),
    copySelection: vi.fn(),
    pasteIntoCurrentFolder: vi.fn(),
    hasClipboard: false,
    previewFile: null,
    showPreview: vi.fn(),
    infoFile: null,
    showInfo: vi.fn(),
    openInNewTab: vi.fn(),
    selectedFiles: [],
    connectedProviders: ["google"],
    connectedAccountsByProvider: {
      google: [
        {
          id: "google-1",
          email: "drive@example.com",
          connectedAt: null,
        },
      ],
      onedrive: [],
    },
    currentFolderId: "root",
    isFavorite: vi.fn(() => false),
    navigateBack: vi.fn(),
    navigateForward: vi.fn(),
    setViewMode: vi.fn(),
    activeTabId: "tab-1",
    ...overrides,
  };
}

describe("FileGrid", () => {
  it("supports tab focus and arrow-key navigation in the file grid", async () => {
    const setSelection = vi.fn();
    mockUseCloud.mockReturnValue(
      buildCloudState({
        setSelection,
        sortBy: "name",
        sortDirection: "asc",
        files: [
          {
            id: "file-1",
            name: "Notes.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "file-2",
            name: "Roadmap.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "file-3",
            name: "Drafts",
            mimeType: "application/vnd.google-apps.folder",
            isFolder: true,
            provider: "google",
          },
        ],
      })
    );

    render(<FileGrid />);

    const grid = screen.getByRole("listbox", { name: /files/i });
    await userEvent.tab();
    expect(grid).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");

    expect(setSelection).toHaveBeenLastCalledWith(["file-1"]);
  });

  it("extends the selection with shift and arrow keys", async () => {
    const setSelection = vi.fn();
    mockUseCloud.mockReturnValue(
      buildCloudState({
        setSelection,
        sortBy: "name",
        sortDirection: "asc",
        files: [
          {
            id: "file-1",
            name: "Notes.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "file-2",
            name: "Roadmap.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "file-3",
            name: "Tasks.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
        ],
      })
    );

    render(<FileGrid />);

    await userEvent.tab();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");

    expect(setSelection).toHaveBeenLastCalledWith(["file-1", "file-2"]);
  });

  it("opens the active file with Enter", async () => {
    const openInNewTab = vi.fn();
    mockUseCloud.mockReturnValue(
      buildCloudState({
        openInNewTab,
        sortBy: "name",
        sortDirection: "asc",
        files: [
          {
            id: "file-1",
            name: "Notes.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "file-2",
            name: "Roadmap.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
        ],
      })
    );

    render(<FileGrid />);

    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Enter}");

    expect(openInNewTab).toHaveBeenCalledWith("file-2");
  });

  it("opens the delete dialog from the keyboard", async () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        selection: ["file-1"],
        selectedFiles: [
          {
            id: "file-1",
            name: "Notes.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
        ],
      })
    );

    render(<FileGrid />);

    await userEvent.tab();
    await userEvent.keyboard("{Delete}");

    expect(screen.getByRole("dialog")).toHaveTextContent(
      /selected items will be removed from current storage/i
    );
  });

  it("selects all visible files with ctrl+a", async () => {
    const setSelection = vi.fn();
    mockUseCloud.mockReturnValue(
      buildCloudState({
        setSelection,
        sortBy: "name",
        sortDirection: "asc",
        files: [
          {
            id: "file-1",
            name: "Notes.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "file-2",
            name: "Roadmap.txt",
            mimeType: "text/plain",
            isFolder: false,
            provider: "google",
          },
          {
            id: "folder-1",
            name: "Drafts",
            mimeType: "application/vnd.google-apps.folder",
            isFolder: true,
            provider: "google",
          },
        ],
      })
    );

    render(<FileGrid />);

    await userEvent.tab();
    await userEvent.keyboard("{Control>}a{/Control}");

    expect(setSelection).toHaveBeenLastCalledWith([
      "folder-1",
      "file-1",
      "file-2",
    ]);
  });

  it("opens the new folder dialog from the background context menu", async () => {
    mockUseCloud.mockReturnValue(buildCloudState());

    const { container } = render(<FileGrid />);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement, {
      clientX: 24,
      clientY: 24,
    });

    await userEvent.click(screen.getByRole("button", { name: /^new folder$/i }));

    expect(screen.getByText(/create folder/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/folder name/i)).toBeInTheDocument();
  });

  it("triggers the file picker from the background context menu upload action", async () => {
    mockUseCloud.mockReturnValue(buildCloudState());
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});

    const { container } = render(<FileGrid />);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement, {
      clientX: 24,
      clientY: 24,
    });

    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("navigates to a merged folder with its provider context", async () => {
    const navigateToFolder = vi.fn();
    mockUseCloud.mockReturnValue(
      buildCloudState({
        provider: null,
        currentLocationProvider: null,
        files: [
          {
            id: "folder-1",
            name: "Designs",
            mimeType: "application/vnd.google-apps.folder",
            isFolder: true,
            provider: "google",
          },
        ],
        navigateToFolder,
      })
    );

    render(<FileGrid />);

    await userEvent.dblClick(screen.getByText("Designs"));

    expect(navigateToFolder).toHaveBeenCalledWith("folder-1", "google");
  });

  it("shows a connect-storage empty state when no provider is connected", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        provider: null,
        currentLocationProvider: null,
        currentLocationAccountId: null,
        files: [],
        connectedProviders: [],
        connectedAccountsByProvider: {
          google: [],
          onedrive: [],
        },
      })
    );

    render(<FileGrid />);

    expect(screen.getByText(/connect a storage provider to get started/i)).toBeInTheDocument();
  });

  it("renders the file preview above finder chrome", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        previewFile: {
          id: "video-1",
          name: "Preview.mp4",
          mimeType: "video/mp4",
          isFolder: false,
          provider: "google",
        },
      })
    );

    render(<FileGrid />);

    const dialog = screen.getByRole("dialog", { name: "Preview.mp4" });
    expect(dialog.parentElement).toHaveClass("z-[80]");
  });

  it("uses the app preview endpoint for inline video playback", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "google",
        previewFile: {
          id: "google-1::video-1",
          name: "Preview.mp4",
          mimeType: "video/mp4",
          previewUrl:
            "/__oneflash/media/google?fileId=google-1%3A%3Avideo-1&accountId=google-1",
          isFolder: false,
          provider: "google",
        },
      })
    );

    render(<FileGrid />);

    const video = screen
      .getByRole("dialog", { name: "Preview.mp4" })
      .querySelector("video") as HTMLVideoElement;

    expect(video.getAttribute("src")).toContain(
      "/api/cloud/google/open?fileId=google-1%3A%3Avideo-1"
    );
    expect(video.getAttribute("src")).not.toContain("/__oneflash/media/google");
  });

  it("prefers browser-direct video playback when the preview worker is ready", () => {
    (
      window as Window & {
        __oneflashCloudPreviewWorkerReady__?: boolean;
      }
    ).__oneflashCloudPreviewWorkerReady__ = true;

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "google",
        previewFile: {
          id: "google-1::video-1",
          name: "Preview.mp4",
          mimeType: "video/mp4",
          previewUrl:
            "/__oneflash/media/google?fileId=google-1%3A%3Avideo-1&accountId=google-1",
          isFolder: false,
          provider: "google",
        },
      })
    );

    render(<FileGrid />);

    return waitFor(() =>
      expect(
        (
          screen
            .getByRole("dialog", { name: "Preview.mp4" })
            .querySelector("video") as HTMLVideoElement
        ).getAttribute("src")
      ).toContain("/__oneflash/media/google")
    );
  });

  it("falls back to the app preview endpoint when direct video playback errors", () => {
    (
      window as Window & {
        __oneflashCloudPreviewWorkerReady__?: boolean;
      }
    ).__oneflashCloudPreviewWorkerReady__ = true;

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "google",
        previewFile: {
          id: "google-1::video-1",
          name: "Preview.mp4",
          mimeType: "video/mp4",
          previewUrl:
            "/__oneflash/media/google?fileId=google-1%3A%3Avideo-1&accountId=google-1",
          isFolder: false,
          provider: "google",
        },
      })
    );

    render(<FileGrid />);

    const dialog = screen.getByRole("dialog", { name: "Preview.mp4" });
    const video = dialog.querySelector("video") as HTMLVideoElement;

    fireEvent.error(video);

    return waitFor(() =>
      expect(
        (
          screen
            .getByRole("dialog", { name: "Preview.mp4" })
            .querySelector("video") as HTMLVideoElement
        ).getAttribute("src")
      ).toContain("/api/cloud/google/open?fileId=google-1%3A%3Avideo-1")
    );
  });

  it("reuses a cached blob preview when reopening the same video", async () => {
    const showPreview = vi.fn();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["video"], { type: "video/mp4" }),
    } as Response);
    const createObjectURL = vi.fn(() => "blob:cached-video");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const state = buildCloudState({
      currentLocationProvider: "google",
      previewFile: {
        id: "google-1::video-1",
        name: "Preview.mp4",
        mimeType: "video/mp4",
        previewUrl:
          "/__oneflash/media/google?fileId=google-1%3A%3Avideo-1&accountId=google-1",
        isFolder: false,
        provider: "google",
      },
      showPreview,
    });
    mockUseCloud.mockReturnValue(state);

    const { rerender } = render(<FileGrid />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole("dialog", { name: "Preview.mp4" });
    fireEvent.click(dialog.querySelector("button") as HTMLButtonElement);
    expect(showPreview).toHaveBeenCalledWith(null);

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "google",
        previewFile: null,
        showPreview,
      })
    );
    rerender(<FileGrid />);

    mockUseCloud.mockReturnValue(state);
    rerender(<FileGrid />);

    await waitFor(() =>
      expect(
        (
          screen
            .getByRole("dialog", { name: "Preview.mp4" })
            .querySelector("video") as HTMLVideoElement
        ).getAttribute("src")
        ).toBe("blob:cached-video")
      );
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("uses previewMimeType when rendering provider-exported previews", () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:proposal-pdf"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
      } as Response)
    );

    mockUseCloud.mockReturnValue(
      buildCloudState({
        previewFile: {
          id: "doc-1",
          name: "Proposal",
          mimeType: "application/vnd.google-apps.document",
          previewMimeType: "application/pdf",
          previewUrl: "https://example.com/proposal.pdf",
          isFolder: false,
          provider: "google",
        },
      })
    );

    render(<FileGrid />);

    return waitFor(() =>
      expect(screen.getByTitle("Proposal")).toHaveAttribute("src", "blob:proposal-pdf")
    );
  });

  it("routes pdf previews through the app preview endpoint", async () => {
    const createObjectURL = vi.fn(() => "blob:manual-pdf");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "onedrive",
        previewFile: {
          id: "pdf-1",
          name: "Manual.pdf",
          mimeType: "application/pdf",
          previewUrl: "https://example.com/manual.pdf",
          directUrl: "https://example.com/manual.pdf",
          isFolder: false,
          provider: "onedrive",
        },
      })
    );

    render(<FileGrid />);

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/cloud/onedrive/open?fileId=pdf-1&name=Manual.pdf&mimeType=application%2Fpdf",
        expect.objectContaining({ cache: "force-cache" })
      )
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(screen.getByTitle("Manual.pdf")).toHaveAttribute("src", "blob:manual-pdf");
  });

  it("loads markdown previews through the app preview endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({
        size: 15,
        text: async () => "# Release Notes",
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "onedrive",
        previewFile: {
          id: "md-1",
          name: "README.md",
          mimeType: "text/plain",
          previewUrl: "https://example.com/readme.md",
          directUrl: "https://example.com/readme.md",
          isFolder: false,
          provider: "onedrive",
        },
      })
    );

    render(<FileGrid />);

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/cloud/onedrive/open?fileId=md-1&name=README.md&mimeType=text%2Fplain",
        { cache: "force-cache" }
      )
    );
    expect(screen.getByText("# Release Notes")).toBeInTheDocument();
  });

  it("renders lazy video thumbnails in the grid", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "google",
            size: 1024,
          },
        ],
      })
    );

    const { container } = render(<FileGrid />);
    expect(container.querySelector('[data-media-thumbnail="video"]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-media-thumbnail="video"] video')
    ).toHaveAttribute("preload", "metadata");
  });

  it("routes grid video thumbnails through the app preview endpoint", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "onedrive",
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "onedrive",
            size: 1024,
            directUrl: "https://example.com/direct.mp4",
            previewUrl: "https://example.com/direct.mp4",
          },
        ],
      })
    );

    const { container } = render(<FileGrid />);
    const video = container.querySelector(
      '[data-media-thumbnail="video"] video'
    ) as HTMLVideoElement;

    expect(video.getAttribute("src")).toContain(
      "/api/cloud/onedrive/open?fileId=video-1"
    );
    expect(video.getAttribute("src")).not.toContain("example.com/direct.mp4");
  });

  it("seeks visible video thumbnails past the opening black frame", () => {
    mockUseCloud.mockReturnValue(
      buildCloudState({
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "google",
            size: 1024,
          },
        ],
      })
    );

    const { container } = render(<FileGrid />);
    const video = container.querySelector('[data-media-thumbnail="video"] video') as HTMLVideoElement;

    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 12,
    });

    fireEvent.loadedMetadata(video);

    expect(video.currentTime).toBeGreaterThan(0);
  });

  it("falls back to the first decoded frame when a thumbnail seek stalls", async () => {
    vi.useFakeTimers();

    mockUseCloud.mockReturnValue(
      buildCloudState({
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "google",
            size: 1024,
          },
        ],
      })
    );

    const { container } = render(<FileGrid />);
    const video = container.querySelector(
      '[data-media-thumbnail="video"] video'
    ) as HTMLVideoElement;

    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 12,
    });

    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => 0,
      set: () => {},
    });

    fireEvent.loadedMetadata(video);
    fireEvent.loadedData(video);

    expect(video.className).toContain("opacity-0");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(video.className).toContain("opacity-100");
    vi.useRealTimers();
  });

  it("warms direct video playback on hover without relying on the app proxy", async () => {
    vi.useFakeTimers();
    const loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "onedrive",
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "onedrive",
            size: 1024,
            directUrl: "https://example.com/direct.mp4",
          },
        ],
      })
    );

    render(<FileGrid />);

    fireEvent.mouseEnter(screen.getByText("Clip").closest('[data-file-item="true"]') as HTMLElement);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(loadSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("warms direct video playback immediately on pointer down", () => {
    const loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "onedrive",
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "onedrive",
            size: 1024,
            directUrl: "https://example.com/direct.mp4",
          },
        ],
      })
    );

    render(<FileGrid />);

    fireEvent.pointerDown(
      screen.getByText("Clip").closest('[data-file-item="true"]') as HTMLElement
    );

    expect(loadSpy).toHaveBeenCalled();
  });

  it("skips hover warmup for videos that would go through the app proxy", async () => {
    vi.useFakeTimers();
    const loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "google",
        files: [
          {
            id: "video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            isFolder: false,
            provider: "google",
            size: 1024,
          },
        ],
      })
    );

    render(<FileGrid />);

    fireEvent.mouseEnter(screen.getByText("Clip").closest('[data-file-item="true"]') as HTMLElement);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(loadSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("warms browser-direct Google previews once the preview worker is ready", async () => {
    vi.useFakeTimers();
    (
      window as Window & {
        __oneflashCloudPreviewWorkerReady__?: boolean;
      }
    ).__oneflashCloudPreviewWorkerReady__ = true;

    const loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});

    mockUseCloud.mockReturnValue(
      buildCloudState({
        currentLocationProvider: "google",
        files: [
          {
            id: "google-1::video-1",
            name: "Clip.mp4",
            mimeType: "video/mp4",
            previewUrl:
              "/__oneflash/media/google?fileId=google-1%3A%3Avideo-1&accountId=google-1",
            isFolder: false,
            provider: "google",
            size: 1024,
          },
        ],
      })
    );

    render(<FileGrid />);

    fireEvent.mouseEnter(screen.getByText("Clip").closest('[data-file-item="true"]') as HTMLElement);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(loadSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("asks for a destination account before root context-menu actions", async () => {
    const state = buildCloudState({
      provider: null,
      currentLocationProvider: null,
      currentLocationAccountId: null,
      connectedProviders: ["google", "onedrive"],
      connectedAccountsByProvider: {
        google: [
          {
            id: "google-1",
            email: "drive@example.com",
            connectedAt: null,
          },
        ],
        onedrive: [
          {
            id: "onedrive-1",
            email: "files@example.com",
            connectedAt: null,
          },
        ],
      },
    });
    mockUseCloud.mockReturnValue(state);

    const { container } = render(<FileGrid />);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement, {
      clientX: 24,
      clientY: 24,
    });
    await userEvent.click(screen.getByRole("button", { name: /^new folder$/i }));
    await userEvent.click(screen.getByRole("button", { name: /files@example.com/i }));
    await userEvent.type(screen.getByPlaceholderText(/folder name/i), "Shared");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(state.createFolder).toHaveBeenCalledWith("Shared", {
      provider: "onedrive",
      accountId: "onedrive-1",
    });

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    fireEvent.contextMenu(container.firstElementChild as HTMLElement, {
      clientX: 24,
      clientY: 24,
    });
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));
    await userEvent.click(screen.getByRole("button", { name: /drive@example.com/i }));
    await waitFor(() =>
      expect(screen.queryByText(/choose upload destination/i)).not.toBeInTheDocument()
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(state.uploadFiles).toHaveBeenCalledTimes(1));
    expect(state.uploadFiles.mock.calls[0]?.[1]).toEqual({
      provider: "google",
      accountId: "google-1",
    });
  });

  it("asks for a destination account after dropping files into a root view", async () => {
    const state = buildCloudState({
      provider: "google",
      currentLocationProvider: "google",
      currentLocationAccountId: null,
      connectedAccountsByProvider: {
        google: [
          {
            id: "google-1",
            email: "drive@example.com",
            connectedAt: null,
          },
          {
            id: "google-2",
            email: "archive@example.com",
            connectedAt: null,
          },
        ],
        onedrive: [],
      },
    });
    mockUseCloud.mockReturnValue(state);

    const { container } = render(<FileGrid />);
    const dropZone = container.firstElementChild as HTMLElement;
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        types: ["Files"],
        items: [],
        files: [file],
      },
    });

    await userEvent.click(
      await screen.findByRole("button", { name: /archive@example.com/i })
    );

    await waitFor(() => expect(state.uploadFiles).toHaveBeenCalledTimes(1));
    expect(state.uploadFiles.mock.calls[0]?.[0]).toEqual([
      {
        file,
        relativePath: "",
      },
    ]);
    expect(state.uploadFiles.mock.calls[0]?.[1]).toEqual({
      provider: "google",
      accountId: "google-2",
    });
  });
});
