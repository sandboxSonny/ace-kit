import { describe, expect, it, vi } from "vitest";

import { publicOrigin, robotsResponse, robotsTxt, sitemapResponse, sitemapXml } from "./sitemap";
import { AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";

describe("publicOrigin", () => {
  it("is the site's domain over https, whatever address the server was reached at behind a proxy", () => {
    // On Railway the server sees only its own internal address.
    expect(publicOrigin(new URL("http://localhost:8080/sitemap.xml"), "adamsdevelopment.co.uk")).toBe(
      "https://adamsdevelopment.co.uk",
    );
    expect(publicOrigin(new URL("http://10.1.2.3:3000/"), " WWW.Example.com ")).toBe("https://www.example.com");
  });

  it("uses the address of the request for a site that has no public address", () => {
    for (const domain of ["localhost", "shop.localhost", "rr1.test", "box.local", "127.0.0.1", undefined]) {
      expect(publicOrigin(new URL("http://localhost:4321/sitemap.xml"), domain), String(domain)).toBe(
        "http://localhost:4321",
      );
    }
    expect(publicOrigin(new URL("http://[::1]:4321/"), "localhost")).toBe("http://[::1]:4321");
  });

  it("gives a real host in the request https when no domain is known", () => {
    expect(publicOrigin(new URL("http://example.com/sitemap.xml"))).toBe("https://example.com");
    expect(publicOrigin(new URL("https://www.example.com:8443/x"))).toBe("https://www.example.com:8443");
  });
});

describe("sitemapXml", () => {
  it("lists each page with its full address and when it last changed", () => {
    const xml = sitemapXml(
      [
        { path: "/", updated_at: "2026-10-16T10:00:00.123Z" },
        { path: "/pages/about", updated_at: "2026-10-01T09:30:00Z" },
      ],
      "https://example.com/",
    );
    expect(xml).toBe(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-10-16T10:00:00.123Z</lastmod>
  </url>
  <url>
    <loc>https://example.com/pages/about</loc>
    <lastmod>2026-10-01T09:30:00.000Z</lastmod>
  </url>
</urlset>
`,
    );
  });

  it("escapes what XML would misread, and leaves out a date it can't read", () => {
    const xml = sitemapXml([{ path: "/a&b/<c>", updated_at: "not a date" }], "https://example.com");
    expect(xml).toContain("<loc>https://example.com/a&amp;b/&lt;c&gt;</loc>");
    expect(xml).not.toContain("lastmod");
  });

  it("is a valid, empty file for a site with no pages", () => {
    expect(sitemapXml([], "https://example.com")).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n',
    );
  });
});

describe("robotsTxt", () => {
  it("lets crawlers in and points them at the sitemap", () => {
    expect(robotsTxt({ origin: "https://example.com/" })).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n",
    );
  });

  it("can ask them all to stay away", () => {
    expect(robotsTxt({ origin: "https://example.com", disallowAll: true })).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("sitemapResponse", () => {
  const clientFor = (getSitemap: () => Promise<unknown>, siteDomain = "example.com") =>
    ({ getSitemap, siteDomain }) as unknown as AceClient;

  it("answers with the CMS's pages as XML, kept briefly", async () => {
    const client = clientFor(async () => [{ path: "/pages/about", updated_at: "2026-10-01T09:30:00Z" }]);
    const response = await sitemapResponse(client, new URL("http://localhost:8080/sitemap.xml"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(await response.text()).toContain("<loc>https://example.com/pages/about</loc>");
  });

  it("uses the address it was told to", async () => {
    const client = clientFor(async () => [{ path: "/", updated_at: "2026-10-01T09:30:00Z" }]);
    const response = await sitemapResponse(client, new URL("http://internal:3000/sitemap.xml"), {
      origin: "https://www.example.com",
    });
    expect(await response.text()).toContain("<loc>https://www.example.com/</loc>");
  });

  it("answers 503 when the CMS can't be reached, so a crawler comes back, and lets other errors through", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const down = clientFor(async () => Promise.reject(new AceUnavailableError("Could not reach the CMS.")));
    const response = await sitemapResponse(down, new URL("http://example.com/sitemap.xml"));
    expect([response.status, response.headers.get("Retry-After")]).toEqual([503, "300"]);
    const broken = clientFor(async () => Promise.reject(new TypeError("a bug")));
    await expect(sitemapResponse(broken, new URL("http://example.com/sitemap.xml"))).rejects.toThrow("a bug");
    quiet.mockRestore();
  });
});

describe("robotsResponse", () => {
  it("is plain text naming the sitemap on the site's domain, not the server's internal address", async () => {
    const response = robotsResponse(new URL("http://localhost:8080/robots.txt"), {}, "example.com");
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("names the address of the request when the site has no public domain", async () => {
    const response = robotsResponse(new URL("http://localhost:4321/robots.txt"), {}, "localhost");
    expect(await response.text()).toContain("Sitemap: http://localhost:4321/sitemap.xml");
  });
});
