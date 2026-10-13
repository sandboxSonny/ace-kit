import { describe, expect, it } from "vitest";

import { domainFromSite, hostedAdminOrigin, hostedApiUrl } from "./platform";

describe("the hosted platform", () => {
  it("is CMS Ace's own API and admin app", () => {
    expect(hostedApiUrl).toBe("https://api.ace-cms.co.uk");
    expect(hostedAdminOrigin).toBe("https://app.ace-cms.co.uk");
  });
});

describe("domainFromSite", () => {
  it("reads a bare domain", () => {
    expect(domainFromSite("example.com")).toBe("example.com");
    expect(domainFromSite("  Example.COM ")).toBe("example.com");
    expect(domainFromSite("example.com:4321")).toBe("example.com");
    expect(domainFromSite("example.com/about")).toBe("example.com");
  });

  it("reads a web address, as Astro's `site` is written", () => {
    expect(domainFromSite("https://example.com")).toBe("example.com");
    expect(domainFromSite("https://Sub.Example.com:8443/blog/")).toBe("sub.example.com");
    expect(domainFromSite("http://localhost:4321")).toBe("localhost");
  });
});
