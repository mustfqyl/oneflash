import { describe, expect, it } from "vitest";
import { getGeoFromHeaders, getGeoFromIP } from "@/lib/geo";

describe("geo helpers", () => {
  it("uses proxy geo headers when available", async () => {
    const headers = new Headers({
      "cf-ipcountry": "TR",
      "cf-ipcity": "Istanbul",
    });

    expect(getGeoFromHeaders(headers)).toEqual({
      country: "TR",
      city: "Istanbul",
    });

    await expect(getGeoFromIP("203.0.113.15", headers)).resolves.toEqual({
      country: "TR",
      city: "Istanbul",
    });
  });

  it("marks local addresses without external lookups", async () => {
    await expect(getGeoFromIP("127.0.0.1")).resolves.toEqual({
      country: "Local",
      city: "Local",
    });
  });
});
