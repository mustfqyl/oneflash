import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignOutDialog from "@/components/finder/SignOutDialog";

const replaceMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

function SignOutDialogHarness() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SignOutDialog
      error={error}
      onClose={vi.fn()}
      onErrorChange={setError}
      onPendingChange={setPending}
      open
      pending={pending}
    />
  );
}

describe("SignOutDialog", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    signOutMock.mockReset();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
  });

  it("shows immediate loading feedback and redirects to login after sign out", async () => {
    let resolveSignOut: (() => void) | undefined;

    signOutMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        })
    );

    render(<SignOutDialogHarness />);

    await userEvent.click(screen.getByRole("button", { name: /^sign out$/i }));

    const pendingButton = screen.getByRole("button", { name: /signing out/i });
    expect(pendingButton).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/device", { method: "POST" });

    resolveSignOut?.();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });
});
