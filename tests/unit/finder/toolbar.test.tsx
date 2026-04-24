import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";
import Toolbar from "@/components/finder/Toolbar";

function buildCloudState(overrides: Record<string, unknown> = {}) {
  return {
    provider: "google",
    currentLocationProvider: "google",
    currentLocationAccountId: "google-1",
    loading: false,
    selection: [],
    deleteSelected: vi.fn(),
    createFolder: vi.fn(),
    navigateBack: vi.fn(),
    navigateForward: vi.fn(),
    canGoBack: true,
    canGoForward: true,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    viewMode: "grid",
    setViewMode: vi.fn(),
    selectedFiles: [{ id: "file-1", name: "Invoice.pdf" }],
    renameFile: vi.fn(),
    duplicateFile: vi.fn(),
    uploadFiles: vi.fn(),
    breadcrumbItems: [
      { id: "root", name: "Files" },
      { id: "child", name: "Docs" },
    ],
    navigateToBreadcrumb: vi.fn(),
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
    ...overrides,
  };
}

describe("Toolbar", () => {
  it("fires navigation and breadcrumb button actions", async () => {
    const state = buildCloudState();
    mockUseCloud.mockReturnValue(state);

    render(<Toolbar />);

    await userEvent.click(screen.getByRole("button", { name: /go back/i }));
    await userEvent.click(screen.getByRole("button", { name: /go forward/i }));
    expect(state.navigateBack).toHaveBeenCalled();
    expect(state.navigateForward).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /files/i }));
    expect(state.navigateToBreadcrumb).toHaveBeenCalledWith(0);
  });

  it("handles rename, duplicate, folder creation, delete confirmation, and upload", async () => {
    const state = buildCloudState();
    mockUseCloud.mockReturnValue(state);

    const firstView = render(<Toolbar />);

    await userEvent.click(screen.getByRole("button", { name: /rename selected item/i }));
    expect(screen.getByText(/rename item/i)).toBeInTheDocument();

    const renameInput = firstView.container.querySelector('.fixed input') as HTMLInputElement;
    await userEvent.clear(renameInput);
    await userEvent.type(renameInput, "Renamed.pdf");
    await userEvent.click(screen.getByRole("button", { name: /^rename$/i }));
    expect(state.renameFile).toHaveBeenCalledWith("file-1", "Renamed.pdf");

    await userEvent.click(screen.getByRole("button", { name: /duplicate selected item/i }));
    expect(state.duplicateFile).toHaveBeenCalledWith("file-1");
    firstView.unmount();

    const folderState = buildCloudState({ selectedFiles: [] });
    mockUseCloud.mockReturnValue(folderState);
    const folderView = render(<Toolbar />);
    await userEvent.click(screen.getByRole("button", { name: /new folder/i }));
    await userEvent.type(screen.getByPlaceholderText(/folder name/i), "Screenshots");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(folderState.createFolder).toHaveBeenCalledWith("Screenshots", undefined);
    folderView.unmount();

    const deleteState = buildCloudState({ selection: ["file-1"] });
    mockUseCloud.mockReturnValue(deleteState);
    const deleteView = render(<Toolbar />);
    await userEvent.click(screen.getByRole("button", { name: /delete \(1\)/i }));
    await userEvent.click(screen.getByRole("button", { name: /^move$/i }));
    expect(deleteState.deleteSelected).toHaveBeenCalled();

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const input = deleteView.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(deleteState.uploadFiles).toHaveBeenCalled());
  });

  it("changes search and view mode", async () => {
    const state = buildCloudState();
    mockUseCloud.mockReturnValue(state);

    render(<Toolbar />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), "report");
    expect(state.setSearchQuery).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /list view/i }));

    expect(state.setViewMode).toHaveBeenCalled();
  });

  it("asks for a destination account at the root before creating folders or uploading", async () => {
    const state = buildCloudState({
      provider: null,
      currentLocationProvider: null,
      currentLocationAccountId: null,
      selectedFiles: [],
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

    const view = render(<Toolbar />);

    await userEvent.click(screen.getByRole("button", { name: /new folder/i }));
    await userEvent.click(screen.getByRole("button", { name: /files@example.com/i }));
    await userEvent.type(screen.getByPlaceholderText(/folder name/i), "Shared");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(state.createFolder).toHaveBeenCalledWith("Shared", {
      provider: "onedrive",
      accountId: "onedrive-1",
    });

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    await userEvent.click(screen.getByRole("button", { name: /upload/i }));
    await userEvent.click(screen.getByRole("button", { name: /drive@example.com/i }));

    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(state.uploadFiles).toHaveBeenCalledTimes(1));
    expect(state.uploadFiles.mock.calls[0]?.[1]).toEqual({
      provider: "google",
      accountId: "google-1",
    });
  });
});
