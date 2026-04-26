import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import CloudConnectionsPage from "@/app/settings/connections/page";

describe("CloudConnectionsPage", () => {
  const fetchMock = vi.fn();
  const assignMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    assignMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: assignMock,
      },
    });
  });

  it("lets the user connect another account on a provider that already has one", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: {
          google: {
            connected: true,
            email: "user@gmail.com",
            connectedAt: null,
            accountCount: 1,
            limit: 5,
            remainingSlots: 4,
            accounts: [
              {
                id: "google-1",
                email: "user@gmail.com",
                connectedAt: null,
                usedBytes: 5 * 1024 ** 3,
                totalBytes: 15 * 1024 ** 3,
                remainingBytes: 10 * 1024 ** 3,
              },
            ],
          },
          onedrive: {
            connected: false,
            email: null,
            connectedAt: null,
            accountCount: 0,
            limit: 5,
            remainingSlots: 5,
            storage: null,
            accounts: [],
          },
        },
      }),
    });

    render(<CloudConnectionsPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: /connect another/i })
    );

    expect(assignMock).toHaveBeenCalledWith("/api/cloud/google/connect");
  });

  it("disconnects a specific connected account and reloads statuses", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: {
            google: {
              connected: true,
              email: "user@gmail.com",
              connectedAt: null,
              accountCount: 2,
              limit: 5,
              remainingSlots: 3,
              accounts: [
                {
                  id: "google-1",
                  email: "user@gmail.com",
                  connectedAt: null,
                  usedBytes: 5 * 1024 ** 3,
                  totalBytes: 15 * 1024 ** 3,
                  remainingBytes: 10 * 1024 ** 3,
                },
                {
                  id: "google-2",
                  email: "other@gmail.com",
                  connectedAt: null,
                  usedBytes: 7 * 1024 ** 3,
                  totalBytes: 15 * 1024 ** 3,
                  remainingBytes: 8 * 1024 ** 3,
                },
              ],
            },
            onedrive: {
              connected: false,
              email: null,
              connectedAt: null,
              accountCount: 0,
              limit: 5,
              remainingSlots: 5,
              storage: null,
              accounts: [],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: {
            google: {
              connected: true,
              email: "other@gmail.com",
              connectedAt: null,
              accountCount: 1,
              limit: 5,
              remainingSlots: 4,
              accounts: [
                {
                  id: "google-2",
                  email: "other@gmail.com",
                  connectedAt: null,
                  usedBytes: 7 * 1024 ** 3,
                  totalBytes: 15 * 1024 ** 3,
                  remainingBytes: 8 * 1024 ** 3,
                },
              ],
            },
            onedrive: {
              connected: false,
              email: null,
              connectedAt: null,
              accountCount: 0,
              limit: 5,
              remainingSlots: 5,
              storage: null,
              accounts: [],
            },
          },
        }),
      });

    render(<CloudConnectionsPage />);

    const disconnectButtons = await screen.findAllByRole("button", { name: /disconnect/i });
    await userEvent.click(disconnectButtons[0]!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/cloud/google/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "google-1" }),
      })
    );
    expect((await screen.findAllByText(/other@gmail.com/i)).length).toBeGreaterThan(0);
  });

  it("disables new connections once a provider reaches the five-account limit", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: {
          google: {
            connected: true,
            email: "user1@gmail.com",
            connectedAt: null,
            accountCount: 5,
            limit: 5,
            remainingSlots: 0,
            accounts: Array.from({ length: 5 }, (_, index) => ({
              id: `google-${index + 1}`,
              email: `user${index + 1}@gmail.com`,
              connectedAt: null,
              usedBytes: 8 * 1024 ** 3,
              totalBytes: 15 * 1024 ** 3,
              remainingBytes: 7 * 1024 ** 3,
            })),
          },
          onedrive: {
            connected: false,
            email: null,
            connectedAt: null,
            accountCount: 0,
            limit: 5,
            remainingSlots: 5,
            storage: null,
            accounts: [],
          },
        },
      }),
    });

    render(<CloudConnectionsPage />);

    expect(await screen.findByRole("button", { name: /limit reached/i })).toBeDisabled();
  });

  it("shows a compact storage bar for each connected account", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: {
          google: {
            connected: true,
            email: "user@gmail.com",
            connectedAt: null,
            accountCount: 2,
            limit: 5,
            remainingSlots: 3,
            accounts: [
              {
                id: "google-1",
                email: "user@gmail.com",
                connectedAt: null,
                usedBytes: 12 * 1024 ** 3,
                totalBytes: 30 * 1024 ** 3,
                remainingBytes: 18 * 1024 ** 3,
              },
              {
                id: "google-2",
                email: "other@gmail.com",
                connectedAt: null,
                usedBytes: 7 * 1024 ** 3,
                totalBytes: 15 * 1024 ** 3,
                remainingBytes: 8 * 1024 ** 3,
              },
            ],
          },
          onedrive: {
            connected: false,
            email: null,
            connectedAt: null,
            accountCount: 0,
            limit: 5,
            remainingSlots: 5,
            storage: null,
            accounts: [],
          },
        },
      }),
    });

    render(<CloudConnectionsPage />);

    expect(await screen.findByText(/12 gb \/ 30 gb/i)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /user@gmail.com storage usage/i })
    ).toHaveAttribute("aria-valuenow", "40");
  });

  it("shows OneDrive as coming soon with a disabled action", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: {
          google: {
            connected: false,
            email: null,
            connectedAt: null,
            accountCount: 0,
            limit: 5,
            remainingSlots: 5,
            accounts: [],
          },
          onedrive: {
            connected: false,
            email: null,
            connectedAt: null,
            accountCount: 0,
            limit: 5,
            remainingSlots: 5,
            storage: null,
            accounts: [],
          },
        },
      }),
    });

    render(<CloudConnectionsPage />);

    expect(await screen.findByRole("heading", { name: /onedrive/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /coming soon/i })).toBeDisabled();
  });
});
