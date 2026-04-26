import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { CloudProvider, useCloud } from "@/components/finder/CloudContext";

vi.mock("next/navigation", () => ({
  usePathname: () => "/files",
  useSearchParams: () => new URLSearchParams(),
}));

function Probe() {
  const { loading, files, connectedProviders, navigateToFolder, uploadFiles } = useCloud();

  return (
    <>
      <div data-testid="state">
        {loading ? "loading" : "idle"}|
        {files.map((file) => file.name).join(",") || "empty"}|
        {connectedProviders.length}
      </div>
      <button type="button" onClick={() => navigateToFolder("folder-1", "google")}>
        Open folder
      </button>
      <button
        type="button"
        onClick={() =>
          uploadFiles([
            {
              file: new File([], "photo-1.jpg", { type: "image/jpeg" }),
              relativePath: "Holiday/photo-1.jpg",
            },
            {
              file: new File([], "photo-2.jpg", { type: "image/jpeg" }),
              relativePath: "Holiday/photo-2.jpg",
            },
          ], {
            provider: "google",
            accountId: "google-1",
          })
        }
      >
        Upload folder
      </button>
    </>
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CloudProvider", () => {
  it("does not loop connection fetches when no storage provider is connected", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "/api/settings/connections") {
        return {
          ok: true,
          json: async () => ({
            providers: {
              google: { connected: false },
              onedrive: { connected: false },
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("idle|empty|0");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears stale files immediately while a new folder is loading", async () => {
    const folderRequest = createDeferred<Response>();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "/api/settings/connections") {
        return {
          ok: true,
          json: async () => ({
            providers: {
              google: {
                connected: true,
                accounts: [
                  {
                    id: "google-1",
                    email: "drive@example.com",
                    connectedAt: null,
                  },
                ],
              },
              onedrive: { connected: false, accounts: [] },
            },
          }),
        } as Response;
      }

      if (url === "/api/cloud/google/files?folderId=root") {
        return {
          ok: true,
          json: async () => ({
            files: [
              {
                id: "folder-1",
                name: "Projects",
                mimeType: "application/vnd.google-apps.folder",
              },
            ],
          }),
        } as Response;
      }

      if (url === "/api/cloud/google/files?folderId=folder-1") {
        return folderRequest.promise;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("idle|Projects|1");
    });

    fireEvent.click(screen.getByRole("button", { name: /open folder/i }));

    expect(screen.getByTestId("state")).toHaveTextContent("loading|empty|1");

    await act(async () => {
      folderRequest.resolve({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "file-1",
              name: "Spec.pdf",
              mimeType: "application/pdf",
            },
          ],
        }),
      } as Response);
    });

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("idle|Spec.pdf|1");
    });
  });

  it("creates a shared top-level folder only once for concurrent uploads", async () => {
    const createFolderMock = vi.fn();
    const uploadRouteMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        file: {
          id: `uploaded-${uploadRouteMock.mock.calls.length}`,
          name: `uploaded-${uploadRouteMock.mock.calls.length}.jpg`,
          mimeType: "image/jpeg",
          modifiedTime: new Date().toISOString(),
          size: "1",
        },
      }),
    }));
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "/api/settings/connections") {
        return {
          ok: true,
          json: async () => ({
            providers: {
              google: { connected: true },
              onedrive: { connected: false },
            },
          }),
        } as Response;
      }

      if (
        url === "/api/cloud/google/files?folderId=root" ||
        url.startsWith("/api/cloud/google/files?folderId=google-1%3A%3Aroot")
      ) {
        return {
          ok: true,
          json: async () => ({
            files: [],
          }),
        } as Response;
      }

      if (url === "/api/cloud/google/files" && init?.method === "POST") {
        createFolderMock();
        return {
          ok: true,
          json: async () => ({
            folder: {
              id: "holiday-folder",
              name: "Holiday",
              mimeType: "application/vnd.google-apps.folder",
            },
          }),
        } as Response;
      }

      if (url === "/api/cloud/google/upload") {
        return (await uploadRouteMock()) as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <CloudProvider>
        <Probe />
      </CloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("idle|empty|1");
    });

    fireEvent.click(screen.getByRole("button", { name: /upload folder/i }));

    await waitFor(() => {
      expect(uploadRouteMock).toHaveBeenCalledTimes(2);
    });

    expect(createFolderMock).toHaveBeenCalledTimes(1);
  });
});
