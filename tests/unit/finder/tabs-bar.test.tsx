import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { mockUseCloud } from "../test-utils/cloud-context";
import TabsBar from "@/components/finder/TabsBar";

describe("TabsBar", () => {
  it("activates, closes, and opens tabs from the visible buttons", async () => {
    const activateTab = vi.fn();
    const closeTab = vi.fn();
    const openTab = vi.fn();

    mockUseCloud.mockReturnValue({
      tabs: [
        { id: "root", title: "Home" },
        { id: "docs", title: "Docs" },
      ],
      activeTabId: "root",
      activateTab,
      closeTab,
      openTab,
      provider: "google",
      currentLocationProvider: "google",
      moveFilesToTab: vi.fn(),
    });

    const { container } = render(<TabsBar />);

    await userEvent.click(screen.getByRole("button", { name: /docs/i }));
    expect(activateTab).toHaveBeenCalledWith("docs");

    fireEvent.click(container.querySelector('[role="button"]')!);
    expect(closeTab).toHaveBeenCalled();

    await userEvent.click(container.querySelectorAll("button")[2]!);
    expect(openTab).toHaveBeenCalledWith("root", "google");
  });
});
