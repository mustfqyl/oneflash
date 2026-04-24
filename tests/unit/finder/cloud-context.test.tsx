import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { CloudProvider, useCloud } from "@/components/finder/CloudContext";

vi.mock("next/navigation", () => ({
  usePathname: () => "/files",
  useSearchParams: () => new URLSearchParams(),
}));

function Probe() {
  const { loading, files, connectedProviders, navigateToFolder } = useCloud();

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
              google: { connected: true },
              onedrive: { connected: false },
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
});
