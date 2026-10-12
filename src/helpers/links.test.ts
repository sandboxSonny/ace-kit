import { describe, expect, it } from "vitest";

import { isInternalPath, linkAddress } from "./links";

describe("isInternalPath", () => {
  it("is true for paths on this site", () => {
    for (const address of ["/", "/pages/about", "/blog-posts/my-post?x=1"]) expect(isInternalPath(address)).toBe(true);
  });

  it("is false for other sites, protocol-relative addresses and mail or phone links", () => {
    for (const address of [
      "https://example.com",
      "http://example.com",
      "//example.com",
      "mailto:a@b.co",
      "tel:+44123",
      "about",
    ]) {
      expect(isInternalPath(address), address).toBe(false);
    }
  });
});

describe("linkAddress", () => {
  it("passes paths, web addresses, mail and phone links, and sends the home entry's own address to /", () => {
    expect(linkAddress("/pages/about")).toBe("/pages/about");
    expect(linkAddress("https://example.com")).toBe("https://example.com");
    expect(linkAddress("/pages/home")).toBe("/");
  });

  it("refuses anything that could run a script or leave the page unexpectedly", () => {
    for (const address of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "/a b", "about"]) {
      expect(linkAddress(address), address).toBeNull();
    }
  });
});
