import {
  getSubdomainFromHost,
  getSubdomainUrl,
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
    expect(getSubdomainFromHost("musti.preview.oneflash.one")).toBeNull();
  });

  it("builds subdomain URLs for both local and production roots", () => {
    expect(getSubdomainUrl("musti", "example.com")).toBe("https://musti.example.com");
    expect(getSubdomainUrl("musti", "lvh.me")).toBe("http://musti.lvh.me:3000");
  });
});
