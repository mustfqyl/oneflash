import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import DomainPage from "@/app/settings/subdomain/page";

describe("DomainPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads the current subdomain and saves changes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ user: { username: "musti" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subdomain: "newname" }),
      });

    render(<DomainPage />);

    expect(await screen.findByDisplayValue("musti")).toBeInTheDocument();
    await userEvent.clear(screen.getByDisplayValue("musti"));
    await userEvent.type(screen.getByPlaceholderText(/your-name/i), "newname");
    fireEvent.submit(screen.getByRole("button", { name: /save domain/i }).closest("form")!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/subdomain/change", expect.objectContaining({
        method: "POST",
      }))
    );
    expect(await screen.findByText(/domain updated successfully/i)).toBeInTheDocument();
  });
});
