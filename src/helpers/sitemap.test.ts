import { describe, expect, it, vi } from "vitest";

import { publicOrigin, robotsResponse, robotsTxt, sitemapResponse, sitemapXml } from "./sitemap";
import { AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";

describe("publicOrigin", () => {
  it("gives a real domain https, whatever a proxy made the server see", () => {
    expect(publicOrigin(new URL("http://example.com/sitemap.xml"))).toBe("https://example.com");
    expect(publicOrigin(new URL("https://www.example.com:8443/x"))).toBe("https://www.example.com:8443");
  });

  it("leaves localhost and addresses as they are", () => {
    expect(publicOrigin(new URL("http://localhost:4321/sitemap.xml"))).toBe("http://localhost:4321");
    expect(publicOrigin(new URL("http://shop.localhost:4321/"))).toBe("http://shop.localhost:4321");
    expect(publicOrigin(new URL("http://127.0.0.1:4321/"))).toBe("http://127.0.0.1:4321");
    expect(publicOrigin(new URL("http://[::1]:4321/"))).toBe("http://[::1]:4321");
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
  const clientFor = (getSitemap: () => Promise<unknown>) => ({ getSitemap }) as unknown as AceClient;

  it("answers with the CMS's pages as XML, kept briefly", async () => {
    const client = clientFor(async () => [{ path: "/pages/about", updated_at: "2026-10-01T09:30:00Z" }]);
    const response = await sitemapResponse(client, new URL("http://example.com/sitemap.xml"));
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
  it("is plain text naming the sitemap on the address it was reached at", async () => {
    const response = robotsResponse(new URL("http://example.com/robots.txt"));
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain("Sitemap: https://example.com/sitemap.xml");
  });
});
