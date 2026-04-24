import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import PinScreen from "@/components/pin/PinScreen";

describe("PinScreen", () => {
  const fetchMock = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("auto-submits six digits and includes trust device state", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<PinScreen subdomain="musti" onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText(/trust this device/i));
    await userEvent.type(screen.getByRole("textbox"), "123456");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/pin/verify", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        pin: "123456",
        subdomain: "musti",
        trustDevice: true,
      }),
    }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows incorrect pin feedback on failed verification", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false }),
    });

    render(<PinScreen subdomain="musti" onSuccess={onSuccess} />);

    await userEvent.type(screen.getByRole("textbox"), "123456");

    expect(await screen.findByText(/incorrect pin/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
