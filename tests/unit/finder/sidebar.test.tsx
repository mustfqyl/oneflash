import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";

const pathnameState = {
  value: "/files",
};

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@/components/finder/SignOutDialog", () => ({
  default: () => null,
}));

import Sidebar from "@/components/finder/Sidebar";

function buildCloudState(overrides: Record<string, unknown> = {}) {
  return {
    provider: null,
    currentLocationProvider: null,
    currentLocationAccountId: null,
    connectedProviders: ["google"],
    connectedAccountsByProvider: {
      google: [
        { id: "google-1", email: "first@gmail.com", connectedAt: null },
        { id: "google-2", email: "second@gmail.com", connectedAt: null },
      ],
      onedrive: [],
    },
    openLocationRoot: vi.fn(),
    ...overrides,
  };
}

describe("Sidebar", () => {
  beforeEach(() => {
    pathnameState.value = "/files";
    routerPush.mockReset();
  });

  it("shows provider accounts in a dropdown and opens the selected account on files", async () => {
    const state = buildCloudState();
    mockUseCloud.mockReturnValue(state);

    render(<Sidebar />);

    await userEvent.click(
      screen.getByRole("button", { name: /google drive accounts/i })
    );
    await userEvent.click(screen.getByRole("button", { name: /second@gmail.com/i }));

    expect(state.openLocationRoot).toHaveBeenCalledWith("google", "google-2");
    expect(routerPush).toHaveBeenCalledWith("/files?provider=google&accountId=google-2");
  });

  it("routes from favorites to the selected provider account in files", async () => {
    pathnameState.value = "/favorites";
    const state = buildCloudState();
    mockUseCloud.mockReturnValue(state);

    render(<Sidebar />);

    await userEvent.click(
      screen.getByRole("button", { name: /google drive accounts/i })
    );
    await userEvent.click(screen.getByRole("button", { name: /first@gmail.com/i }));

    expect(routerPush).toHaveBeenCalledWith("/files?provider=google&accountId=google-1");
  });

  it("returns to all files from a provider view on files", async () => {
    const state = buildCloudState({
      provider: "google",
      currentLocationProvider: "google",
      currentLocationAccountId: "google-1",
    });
    mockUseCloud.mockReturnValue(state);

    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: /all files/i }));

    expect(state.openLocationRoot).toHaveBeenCalledWith(null, null);
    expect(routerPush).toHaveBeenCalledWith("/files");
  });
});
