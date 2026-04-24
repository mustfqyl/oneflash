import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import AccountPage from "@/app/settings/account/page";

describe("AccountPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads account data and saves the profile form", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            username: "musti",
            email: "user@example.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subdomain: "new-name",
        }),
      });

    render(<AccountPage />);

    const usernameInput = await screen.findByLabelText(/username/i);
    expect(screen.getByLabelText(/email/i)).toHaveValue("user@example.com");

    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, "new-name");
    fireEvent.submit(screen.getByRole("button", { name: /save profile/i }).closest("form")!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/subdomain/change", expect.objectContaining({
        method: "POST",
      }))
    );
    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toHaveValue("new-name");
  });

  it("posts password changes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            username: "musti",
            email: "user@example.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const { container } = render(<AccountPage />);

    await screen.findByDisplayValue("musti");
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    await userEvent.type(passwordInputs[0]!, "old-pass");
    await userEvent.type(passwordInputs[1]!, "NewPassword1");
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/settings/password", expect.objectContaining({
        method: "POST",
      }))
    );
    expect(await screen.findByText(/password changed/i)).toBeInTheDocument();
  });

  it("blocks weak passwords before posting", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          username: "musti",
          email: "user@example.com",
        },
      }),
    });

    const { container } = render(<AccountPage />);

    await screen.findByDisplayValue("musti");
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    await userEvent.type(passwordInputs[0]!, "old-pass");
    await userEvent.type(passwordInputs[1]!, "alllowercase12");
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    expect(
      await screen.findByText(/password must include uppercase, lowercase, and a number/i)
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
