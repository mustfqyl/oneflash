import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { routerPush, routerRefresh } from "../test-utils/router";
import RegisterPage from "@/app/(auth)/register/page";

const signIn = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

describe("RegisterPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("blocks submit when pin is not six digits", async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^username$/i), "musti");
    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "secret");
    await userEvent.type(screen.getByLabelText(/6-digit access pin/i), "123");
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    expect(await screen.findByText(/pin must be exactly 6 digits/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers and signs in on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    signIn.mockResolvedValue({});

    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^username$/i), "musti");
    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Secret1234");
    await userEvent.type(screen.getByLabelText(/6-digit access pin/i), "123456");
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
        method: "POST",
      }))
    );
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "Secret1234",
      redirect: false,
    });
    expect(routerPush).toHaveBeenCalledWith("/files");
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("shows backend errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "taken" }),
    });

    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^username$/i), "musti");
    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Secret1234");
    await userEvent.type(screen.getByLabelText(/6-digit access pin/i), "123456");
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    expect(await screen.findByText("taken")).toBeInTheDocument();
  });

  it("blocks submit when password does not meet the policy", async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^username$/i), "musti");
    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "alllowercase12");
    await userEvent.type(screen.getByLabelText(/6-digit access pin/i), "123456");
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    expect(
      await screen.findByText(/password must include uppercase, lowercase, and a number/i)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
