import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MockInstance } from "vitest";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";
import FileGrid from "@/components/finder/FileGrid";

vi.mock("next/navigation", () => ({
  usePathname: () => "/files",
}));

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
  let canvasContextSpy: MockInstance;
  let canvasDataUrlSpy: MockInstance;

  afterEach(() => {
    canvasContextSpy?.mockRestore();
    canvasDataUrlSpy?.mockRestore();
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

  it("retries later frames when a video thumbnail first resolves to a dark frame", () => {
    canvasContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(function mockGetContext(this: HTMLCanvasElement) {
        let lastVideoTime = 0;

        return {
          drawImage: (source: unknown) => {
            if (source instanceof HTMLVideoElement) {
              lastVideoTime = source.currentTime;
            }
          },
          getImageData: () => ({
            data: new Uint8ClampedArray(
              Array.from({ length: 8 * 8 * 4 }, (_, index) => {
                if (index % 4 === 3) {
                  return 255;
                }
                return lastVideoTime < 2 ? 0 : 180;
              })
            ),
          }),
        } as unknown as CanvasRenderingContext2D;
      });

    canvasDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/jpeg;base64,thumbnail");

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
    const video = container.querySelector("video");

    expect(video).not.toBeNull();

    Object.defineProperties(video as HTMLVideoElement, {
      duration: {
        configurable: true,
        value: 10,
      },
      videoWidth: {
        configurable: true,
        value: 640,
      },
      videoHeight: {
        configurable: true,
        value: 360,
      },
    });

    fireEvent.loadedMetadata(video as HTMLVideoElement);
    expect((video as HTMLVideoElement).currentTime).toBeCloseTo(1.2);

    fireEvent.seeked(video as HTMLVideoElement);
    expect((video as HTMLVideoElement).currentTime).toBeCloseTo(2.4);

    fireEvent.seeked(video as HTMLVideoElement);

    const thumbnail = container.querySelector('img[src="data:image/jpeg;base64,thumbnail"]');
    expect(thumbnail).not.toBeNull();
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

    expect(state.uploadFiles).toHaveBeenCalled();
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
