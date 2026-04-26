import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/security";

describe("getClientIp", () => {
  it("prefers the Cloudflare client IP when present", () => {
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.10",
      "x-forwarded-for": "203.0.113.20, 10.0.0.1",
      "x-real-ip": "192.0.2.15",
    });

    expect(getClientIp(headers)).toBe("198.51.100.10");
  });

  it("falls back to the forwarded header before x-real-ip", () => {
    expect(
      getClientIp({
        forwarded: 'for="203.0.113.7";proto=https',
        "x-real-ip": "192.0.2.15",
      })
    ).toBe("203.0.113.7");
  });
});
