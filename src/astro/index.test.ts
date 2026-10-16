import { afterEach, describe, expect, it, vi } from "vitest";

import { applyPage, getMenuLinks, getPage, getRobotsResponse, getSitemapResponse } from "./index";
import integration from "./integration";
import { onRequest } from "./middleware";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchSpy = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchSpy);
afterEach(() => fetchSpy.mockReset());

const entry = { id: 1, content_type_handle: "pages", handle: "about", title: "About", values: {} };
const astroFor = (path: string) => ({
  url: new URL(`http://site.test${path}`),
  response: { status: 200, headers: new Headers() },
});

describe("the middleware", () => {
  it("lets the admin app frame every page, and no one else", async () => {
    const response = await onRequest(undefined, async () => new Response("page"));
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'self' http://localhost:5173");
    expect(await response.text()).toBe("page");
  });
});

describe("the middleware and a policy the site already has", () => {
  it("adds to it instead of replacing it", async () => {
    const response = await onRequest(undefined, async () => {
      const original = new Response("page");
      original.headers.set("Content-Security-Policy", "default-src 'self'");
      return original;
    });
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; frame-ancestors 'self' http://localhost:5173",
    );
  });
});

describe("applyPage", () => {
  it("puts the page's status and headers on the response", () => {
    const response = { status: 200, headers: new Headers() };
    applyPage(response, { status: 404, headers: { "Cache-Control": "no-store" } });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("getPage", () => {
  it("asks the configured API as the configured site, for the entry at the address", async () => {
    fetchSpy.mockResolvedValue(json(entry));
    const astro = astroFor("/pages/about");
    const page = await getPage(astro);

    expect(page).toMatchObject({ kind: "entry", status: 200 });
    const [address, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(address).toBe("https://api.example.test/public/entries/about");
    expect((init.headers as Record<string, string>)["X-Ace-Site-Domain"]).toBe("site.example.test");
    expect((init.headers as Record<string, string>)["X-Forwarded-Host"]).toBe("site.example.test");
  });

  it("sets the response's status and headers, so a missing page is a 404", async () => {
    fetchSpy.mockResolvedValue(json({ error: "entry not found" }, 404));
    const astro = astroFor("/pages/nope");
    await getPage(astro);
    expect(astro.response.status).toBe(404);
  });

  it("treats the root as the home entry and redirects the home entry's own address to it", async () => {
    fetchSpy.mockResolvedValue(json({ ...entry, handle: "home" }));
    expect(await getPage(astroFor("/"))).toMatchObject({ kind: "entry" });
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.example.test/public/entries/home");

    expect(await getPage(astroFor("/pages/home/"))).toMatchObject({ kind: "redirect", location: "/", status: 301 });
  });
});

describe("getMenuLinks", () => {
  const menu = {
    name: "Main",
    handle: "main",
    items: [{ label: "About", url: "/pages/about", kind: "entry", entry: null, children: [] }],
  };
  const fallback = [{ label: "Home", to: "/" }];

  it("gives the menu's links", async () => {
    fetchSpy.mockResolvedValue(json(menu));
    expect(await getMenuLinks("main", { fallback })).toEqual([{ label: "About", to: "/pages/about" }]);
  });

  it("gives the fallback for a menu the site doesn't have, and when the CMS is down", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchSpy.mockResolvedValue(json({ error: "menu not found" }, 404));
    expect(await getMenuLinks("nope", { fallback })).toEqual(fallback);
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getMenuLinks("down", { fallback })).toEqual(fallback);
    expect(await getMenuLinks("down")).toEqual([]);
    quiet.mockRestore();
  });
});

describe("the integration", () => {
  async function setUp(site?: string) {
    const updates: Record<string, unknown>[] = [];
    const middleware: unknown[] = [];
    const hook = integration().hooks["astro:config:setup"] as (parameters: unknown) => Promise<void>;
    await hook({
      command: "build",
      config: { site, root: new URL("file:///site/") },
      logger: { info: () => undefined, warn: () => undefined },
      updateConfig: (update: Record<string, unknown>) => updates.push(update),
      addMiddleware: (added: unknown) => middleware.push(added),
    });
    return { updates, middleware };
  }

  it("declares the three settings as secrets, so they are read at runtime", async () => {
    const [update] = (await setUp()).updates as {
      env: { schema: Record<string, { access: string; context: string; default: string }> };
    }[];
    expect(Object.keys(update.env.schema)).toEqual(["ACE_API_URL", "ACE_SITE_DOMAIN", "ACE_PREVIEW_ADMIN_ORIGIN"]);
    for (const setting of Object.values(update.env.schema)) {
      expect([setting.access, setting.context]).toEqual(["secret", "server"]);
    }
    // The hosted platform is the default: a site only says where it is when the CMS is on its own machine.
    expect(update.env.schema.ACE_API_URL.default).toBe("https://api.ace-cms.co.uk");
    expect(update.env.schema.ACE_PREVIEW_ADMIN_ORIGIN.default).toBe("https://app.ace-cms.co.uk");
    expect(update.env.schema.ACE_SITE_DOMAIN.default).toBe("localhost");
  });

  it("takes the site's domain from Astro's own `site` setting, written as a web address", async () => {
    for (const site of [
      "https://example.adamsdevelopment.co.uk",
      "https://Example.adamsdevelopment.co.uk:8443/blog/",
    ]) {
      const [update] = (await setUp(site)).updates as { env: { schema: Record<string, { default: string }> } }[];
      expect(update.env.schema.ACE_SITE_DOMAIN.default, site).toBe("example.adamsdevelopment.co.uk");
    }
  });

  it("has Vite process the kit, because it reads its settings through astro:env", async () => {
    const [update] = (await setUp()).updates as { vite: { ssr: { noExternal: string[] } } }[];
    expect(update.vite.ssr.noExternal).toEqual(["@sandboxsonny/ace-kit"]);
  });

  it("registers the framing middleware before the site's own", async () => {
    expect((await setUp()).middleware).toEqual([
      { entrypoint: "@sandboxsonny/ace-kit/astro/middleware", order: "pre" },
    ]);
  });
});

describe("getSitemapResponse and getRobotsResponse", () => {
  it("builds the sitemap from the CMS's pages, as the configured site", async () => {
    fetchSpy.mockResolvedValue(json([{ path: "/pages/about", updated_at: "2026-10-01T09:30:00Z" }]));
    const response = await getSitemapResponse({ url: new URL("http://site.test/sitemap.xml") });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/public/sitemap");
    expect(await response.text()).toContain("<loc>https://site.test/pages/about</loc>");
  });

  it("builds robots.txt without asking the CMS", async () => {
    const response = getRobotsResponse({ url: new URL("http://localhost:4321/robots.txt") });
    expect(await response.text()).toContain("Sitemap: http://localhost:4321/sitemap.xml");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
