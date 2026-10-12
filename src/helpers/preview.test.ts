// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  addFramingPolicy,
  framingPolicy,
  isRefreshRequest,
  originOf,
  previewHeaders,
  previewTokenFrom,
  swapPageContent,
} from "./preview";

const admin = "http://localhost:5173";

describe("isRefreshRequest", () => {
  it("accepts the refresh message from the admin origin", () => {
    expect(isRefreshRequest({ origin: admin, data: { type: "cms-ace:refresh" } }, admin)).toBe(true);
  });

  it("ignores the same message from anywhere else", () => {
    expect(isRefreshRequest({ origin: "https://evil.example", data: { type: "cms-ace:refresh" } }, admin)).toBe(false);
    expect(isRefreshRequest({ origin: "http://localhost:5174", data: { type: "cms-ace:refresh" } }, admin)).toBe(false);
  });

  it("ignores other messages, whoever sends them", () => {
    for (const data of [undefined, null, "cms-ace:refresh", 42, {}, { type: "other" }]) {
      expect(isRefreshRequest({ origin: admin, data }, admin)).toBe(false);
    }
  });
});

describe("previewTokenFrom", () => {
  it("reads the token from the address", () => {
    expect(previewTokenFrom(new URL("http://localhost:4321/pages/about?cms_preview=abc"))).toBe("abc");
  });

  it("is null without one, or with an empty one", () => {
    expect(previewTokenFrom(new URL("http://localhost:4321/pages/about"))).toBeNull();
    expect(previewTokenFrom(new URL("http://localhost:4321/pages/about?cms_preview="))).toBeNull();
  });
});

describe("originOf", () => {
  it("is the scheme, host and port of a web address", () => {
    expect(originOf("http://localhost:5173")).toBe("http://localhost:5173");
    expect(originOf("https://admin.example.com/some/path?x=1")).toBe("https://admin.example.com");
    expect(originOf("https://ADMIN.example.com:443/")).toBe("https://admin.example.com");
  });

  it("is null for anything that isn't a web address", () => {
    for (const address of ["", "admin.example.com", "javascript:alert(1)", "ftp://x.test", "not a url"]) {
      expect(originOf(address), address).toBeNull();
    }
  });
});

describe("isRefreshRequest and the admin address", () => {
  it("still works when the admin address was written with a slash or a path", () => {
    const message = { origin: "https://admin.example.com", data: { type: "cms-ace:refresh" } };
    expect(isRefreshRequest(message, "https://admin.example.com/")).toBe(true);
    expect(isRefreshRequest(message, "https://admin.example.com/login")).toBe(true);
  });

  it("accepts nothing when the admin address isn't a web address", () => {
    expect(isRefreshRequest({ origin: "null", data: { type: "cms-ace:refresh" } }, "nonsense")).toBe(false);
  });
});

describe("addFramingPolicy", () => {
  const withPolicy = (existing: string | null) => {
    const headers = new Headers(existing === null ? {} : { "Content-Security-Policy": existing });
    addFramingPolicy(headers, admin);
    return headers.get("Content-Security-Policy");
  };

  it("sets the policy when the site sends none", () => {
    expect(withPolicy(null)).toBe("frame-ancestors 'self' http://localhost:5173");
  });

  it("adds to a policy the site already sends instead of replacing it", () => {
    expect(withPolicy("default-src 'self'; img-src https:")).toBe(
      "default-src 'self'; img-src https:; frame-ancestors 'self' http://localhost:5173",
    );
  });

  it("replaces only the site's own frame-ancestors, which would stop the editor showing the site", () => {
    expect(withPolicy("default-src 'self'; frame-ancestors 'none'; img-src https:")).toBe(
      "default-src 'self'; img-src https:; frame-ancestors 'self' http://localhost:5173",
    );
    expect(withPolicy("FRAME-ANCESTORS 'none'")).toBe("frame-ancestors 'self' http://localhost:5173");
  });

  it("does not mistake a directive that merely starts the same", () => {
    expect(withPolicy("frame-ancestors-extra x")).toContain("frame-ancestors-extra x");
  });
});

describe("framingPolicy", () => {
  it("refuses an admin address that isn't a web address, rather than sending a broken or injectable header", () => {
    for (const address of ["", "nonsense", "javascript:alert(1)"]) {
      expect(() => framingPolicy(address), address).toThrow(/ACE_PREVIEW_ADMIN_ORIGIN/);
    }
  });

  it("can't be given extra directives through the address, and tidies a harmless one", () => {
    expect(() => framingPolicy("http://localhost:5173; script-src *")).toThrow(/ACE_PREVIEW_ADMIN_ORIGIN/);
    expect(framingPolicy("https://admin.example.com/path")).toBe("frame-ancestors 'self' https://admin.example.com");
  });

  it("lets the site and the admin app frame the page, and no one else", () => {
    expect(framingPolicy(admin)).toBe("frame-ancestors 'self' http://localhost:5173");
  });
});

describe("previewHeaders", () => {
  it("keeps a preview out of every cache and search engine", () => {
    expect(previewHeaders).toEqual({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  });
});

describe("swapPageContent", () => {
  const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

  it("replaces the title and the body's content but keeps the body itself and the head", () => {
    const current = parse(
      '<title>Old</title><meta name="x" content="kept"><body data-cms-preview-origin="o"><h1>Old</h1></body>',
    );
    const fresh = parse("<title>New</title><body><h1>New heading</h1><p>New text</p></body>");
    const body = current.body;

    swapPageContent(current, fresh);

    expect(current.title).toBe("New");
    expect(current.body).toBe(body);
    expect(current.body.dataset.cmsPreviewOrigin).toBe("o");
    expect(current.body.innerHTML).toBe("<h1>New heading</h1><p>New text</p>");
    expect(current.head.querySelector('meta[name="x"]')).toBeTruthy();
  });

  it("does not run scripts that arrive in the new content", () => {
    const current = parse("<body></body>");
    const fresh = parse("<body><p>Hi</p><script>window.__ran = true</script></body>");
    swapPageContent(current, fresh);
    expect((current.defaultView as unknown as { __ran?: boolean } | null)?.__ran).toBeUndefined();
  });
});
