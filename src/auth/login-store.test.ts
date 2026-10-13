import { describe, expect, it } from "vitest";

import { hasExpired, normaliseApiUrl, parseStoredLogin } from "./login-store";

describe("normaliseApiUrl", () => {
  it("writes one CMS the same way however its address was typed", () => {
    for (const typed of ["http://localhost:8080", "HTTP://LOCALHOST:8080/", "  http://localhost:8080//  "]) {
      expect(normaliseApiUrl(typed), typed).toBe("http://localhost:8080");
    }
    expect(normaliseApiUrl("https://api.ace-cms.co.uk/")).toBe("https://api.ace-cms.co.uk");
    expect(normaliseApiUrl("https://example.com/cms/api/")).toBe("https://example.com/cms/api");
  });

  it("drops the default port, a query and a fragment", () => {
    expect(normaliseApiUrl("https://api.example.com:443/?x=1#top")).toBe("https://api.example.com");
  });

  it.each([
    ["not a web address", "localhost:8080x"],
    ["nothing", ""],
    ["a file", "file:///etc/passwd"],
    ["javascript", "javascript:alert(1)"],
    ["a username and password", "https://user:secret@example.com"],
  ])("refuses %s", (_name, typed) => {
    expect(() => normaliseApiUrl(typed)).toThrow();
  });

  it("never leaves a quote, backslash or space in what it returns", () => {
    for (const typed of [
      'https://example.com/a"b',
      "https://example.com/a b",
      "https://example.com/a\\b",
      'https://example.com/"; rm -rf ~',
    ]) {
      expect(normaliseApiUrl(typed)).not.toMatch(/["\\\s]/);
    }
  });
});

describe("hasExpired", () => {
  const login = { token: "t", email: "a@b.co", expiresAt: "2026-10-13T12:00:00Z" };

  it("is false before the time and true from it on", () => {
    expect(hasExpired(login, Date.parse("2026-10-13T11:59:59Z"))).toBe(false);
    expect(hasExpired(login, Date.parse("2026-10-13T12:00:00Z"))).toBe(true);
    expect(hasExpired(login, Date.parse("2026-10-14T00:00:00Z"))).toBe(true);
  });

  it("treats a time it can't read as run out, so a damaged login is never used", () => {
    expect(hasExpired({ ...login, expiresAt: "soon" }, 0)).toBe(true);
    expect(hasExpired({ ...login, expiresAt: "" }, 0)).toBe(true);
  });
});

describe("parseStoredLogin", () => {
  it("reads a login and ignores anything else in the object", () => {
    expect(parseStoredLogin({ token: "t", expiresAt: "x", email: "a@b.co", extra: 1 })).toEqual({
      token: "t",
      expiresAt: "x",
      email: "a@b.co",
    });
  });

  it.each([
    null,
    undefined,
    "text",
    5,
    [],
    {},
    { token: "", expiresAt: "x", email: "a" },
    { token: "t", expiresAt: 5, email: "a" },
    { token: "t", expiresAt: "x" },
  ])("reads %j as no login", (value) => {
    expect(parseStoredLogin(value)).toBeNull();
  });
});
