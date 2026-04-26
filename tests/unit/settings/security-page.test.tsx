import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SecurityPage from "@/app/settings/security/page";

describe("SecurityPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("validates pin inputs before submit", async () => {
    render(<SecurityPage />);

    const inputs = screen.getAllByPlaceholderText("******");
    await userEvent.type(inputs[0]!, "123");
    await userEvent.type(inputs[1]!, "456");
    fireEvent.submit(screen.getByRole("button", { name: /update pin/i }).closest("form")!);

    expect(await screen.findByText(/both pin fields must be exactly 6 digits/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts pin update when valid", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<SecurityPage />);

    const inputs = screen.getAllByPlaceholderText("******");
    await userEvent.type(inputs[0]!, "123456");
    await userEvent.type(inputs[1]!, "123456");
    fireEvent.submit(screen.getByRole("button", { name: /update pin/i }).closest("form")!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/pin/change", expect.objectContaining({
        method: "POST",
      }))
    );
    expect(await screen.findByText(/pin successfully updated/i)).toBeInTheDocument();
  });
});
