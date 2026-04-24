import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { routerPush, routerRefresh } from "../test-utils/router";
import LoginPage from "@/app/(auth)/login/page";

const signIn = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

describe("LoginPage", () => {
  it("submits credentials and routes to files on success", async () => {
    signIn.mockResolvedValue({});

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "user@example.com",
        password: "secret",
        redirect: false,
      })
    );
    expect(routerPush).toHaveBeenCalledWith("/files");
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("renders an error when credential auth fails", async () => {
    signIn.mockResolvedValue({ error: "bad credentials" });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("surfaces rate limit errors from auth", async () => {
    signIn.mockResolvedValue({
      error: "Too many login attempts. Please wait a few minutes and try again.",
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "Secret1234");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    expect(
      await screen.findByText(/too many login attempts\. please wait a few minutes and try again\./i)
    ).toBeInTheDocument();
  });
});
