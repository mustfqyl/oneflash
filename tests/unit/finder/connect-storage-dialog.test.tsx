import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";
import ConnectStorageDialog from "@/components/finder/ConnectStorageDialog";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("ConnectStorageDialog", () => {
  it("stays hidden until connections are loaded", () => {
    mockUseCloud.mockReturnValue({
      connectedProviders: [],
      connectionsLoaded: false,
    });

    render(<ConnectStorageDialog />);

    expect(
      screen.queryByRole("heading", { name: /connect a storage first/i })
    ).not.toBeInTheDocument();
  });

  it("routes to cloud connections when no provider is connected", async () => {
    mockUseCloud.mockReturnValue({
      connectedProviders: [],
      connectionsLoaded: true,
    });

    render(<ConnectStorageDialog />);

    await userEvent.click(
      screen.getByRole("button", { name: /open cloud connections/i })
    );

    expect(pushMock).toHaveBeenCalledWith("/settings/connections");
  });

  it("stays hidden when at least one provider is already connected", () => {
    mockUseCloud.mockReturnValue({
      connectedProviders: ["google"],
      connectionsLoaded: true,
    });

    render(<ConnectStorageDialog />);

    expect(
      screen.queryByRole("button", { name: /go to cloud connections/i })
    ).not.toBeInTheDocument();
  });
});
