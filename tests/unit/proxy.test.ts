import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

import { proxy } from "@/proxy";

describe("proxy subdomain routing", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("lets known subdomain requests continue without forcing a rewrite", async () => {
    findUnique.mockResolvedValue({ username: "musti" });

    const request = new NextRequest("http://test.oneflash.one:3000/", {
      headers: {
        host: "test.oneflash.one:3000",
      },
    });

    const response = await proxy(request);

    expect(findUnique).toHaveBeenCalledWith({
      where: { customDomain: "test" },
      select: { username: true },
    });
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("redirects unknown subdomains back to the apex domain", async () => {
    findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://ghost.oneflash.one:3000/files", {
      headers: {
        host: "ghost.oneflash.one:3000",
      },
    });

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe("http://oneflash.one:3000/files");
  });
});
