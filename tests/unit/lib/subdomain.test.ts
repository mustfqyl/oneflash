import {
  getSubdomainFromHost,
  getSubdomainValidationError,
} from "@/lib/subdomain";

describe("subdomain utilities", () => {
  it("rejects labels with leading or trailing hyphens", () => {
    expect(getSubdomainValidationError("-musti")).toMatch(/start and end/i);
    expect(getSubdomainValidationError("musti-")).toMatch(/start and end/i);
  });

  it("extracts valid scoped subdomains and ignores preview or root hosts", () => {
    expect(getSubdomainFromHost("musti.oneflash.one")).toBe("musti");
    expect(getSubdomainFromHost("www.oneflash.one")).toBeNull();
    expect(getSubdomainFromHost("musti.vercel.app")).toBeNull();
  });
});
