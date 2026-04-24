import { vi } from "vitest";

export const mockUseCloud = vi.fn();

vi.mock("@/components/finder/CloudContext", () => ({
  useCloud: () => mockUseCloud(),
}));
