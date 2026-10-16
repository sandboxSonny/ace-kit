import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchSpy = vi.fn<typeof fetch>();
const entry = {
  id: 1,
  content_type_id: 1,
  content_type_handle: "pages",
  handle: "about",
  title: "About",
  description: "",
  values: {},
};

/** The server module afresh, because it keeps one client (and that client keeps answers for a few seconds). */
async function server() {
  vi.resetModules();
  return import("./server");
}

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("ACE_API_URL", "https://api.example.test");
  vi.stubEnv("ACE_SITE_DOMAIN", "site.example.test");
  vi.stubEnv("ACE_PREVIEW_ADMIN_ORIGIN", "http://localhost:5173");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const asked = () =>
  new URL(String(fetchSpy.mock.calls.at(-1)?.[0])).pathname + new URL(String(fetchSpy.mock.calls.at(-1)?.[0])).search;

/** Runs a page loader for an address and says what it answered with. */
async function load(loader: (arguments_: { request: Request }) => Promise<unknown>, path: string) {
  const result = (await loader({ request: new Request(`http://site.test${path}`) })) as
    Response | { init: { status?: number; headers?: HeadersInit } | null; data: unknown };
  if (result instanceof Response) return { status: result.status, headers: result.headers, data: undefined };
  return { status: result.init?.status ?? 200, headers: new Headers(result.init?.headers), data: result.data };
}

describe("the settings", () => {
  it("make a client for the configured API and site", async () => {
    fetchSpy.mockResolvedValue(json(entry));
    const { getEntry } = await server();
    await getEntry("pages", "about");
    const [address, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(address).toBe("https://api.example.test/public/entries/about");
    expect((init.headers as Record<string, string>)["X-Ace-Site-Domain"]).toBe("site.example.test");
    expect((init.headers as Record<string, string>)["X-Forwarded-Host"]).toBe("site.example.test");
  });

  it("default to the hosted CMS Ace", async () => {
    vi.stubEnv("ACE_API_URL", undefined as unknown as string);
    vi.stubEnv("ACE_SITE_DOMAIN", undefined as unknown as string);
    delete process.env.ACE_API_URL;
    delete process.env.ACE_SITE_DOMAIN;
    fetchSpy.mockResolvedValue(json(entry));
    const { getEntry } = await server();
    await getEntry("pages", "about");
    const [address, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(address).toBe("https://api.ace-cms.co.uk/public/entries/about");
    expect((init.headers as Record<string, string>)["X-Ace-Site-Domain"]).toBe("localhost");
    expect((init.headers as Record<string, string>)["X-Forwarded-Host"]).toBe("localhost");
  });
});

describe("createPageLoader", () => {
  it("loads the entry at /{content type}/{entry}, from the address alone", async () => {
    fetchSpy.mockResolvedValue(json(entry));
    const { loader } = await server();
    const response = await load(loader, "/pages/about");
    expect(asked()).toBe("/public/entries/about");
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ kind: "entry" });
  });

  it("loads the home entry at the root", async () => {
    fetchSpy.mockResolvedValue(json({ ...entry, handle: "home" }));
    const { loader } = await server();
    await load(loader, "/");
    expect(asked()).toBe("/public/entries/home");
  });

  it("answers 404 for a page that isn't there and for an address that isn't a page, so the site can say so", async () => {
    const { loader } = await server();
    fetchSpy.mockResolvedValue(json({ error: "entry not found" }, 404));
    expect(await load(loader, "/pages/nope")).toMatchObject({ status: 404, data: { kind: "not-found" } });
    fetchSpy.mockClear();
    expect((await load(loader, "/a/b/c")).status).toBe(404);
    expect(asked()).toBe("/public/redirects?from=%2Fa%2Fb%2Fc"); // it looked for a redirect, not for an entry
  });

  it("redirects an address that isn't a page when the site has a redirect for it", async () => {
    const { loader } = await server();
    fetchSpy.mockResolvedValue(json({ from: "/about-us", to: "/pages/about", status: 301 }));
    const response = await load(loader, "/about-us");
    expect([response.status, response.headers.get("Location")]).toEqual([301, "/pages/about"]);
    expect(asked()).toBe("/public/redirects?from=%2Fabout-us");
  });

  it("redirects the home entry's own address to the root", async () => {
    const { loader } = await server();
    const response = await load(loader, "/pages/home");
    expect([response.status, response.headers.get("Location")]).toEqual([301, "/"]);
  });

  it("answers 503 when the CMS can't be reached or fails", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { loader } = await server();
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    expect((await load(loader, "/pages/about")).status).toBe(503);
    fetchSpy.mockResolvedValue(json({ error: "boom" }, 500));
    expect((await load(loader, "/pages/other")).status).toBe(503);
    quiet.mockRestore();
  });

  it("answers 403 when the preview link has run out, and never lets that be cached", async () => {
    fetchSpy.mockResolvedValue(json({ error: "preview link is invalid or has expired" }, 403));
    const { loader } = await server();
    const response = await load(loader, "/pages/about?cms_preview=old");
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes a preview token on, and keeps the preview out of caches and search engines", async () => {
    fetchSpy.mockResolvedValue(json(entry));
    const { loader } = await server();
    const response = await load(loader, "/pages/about?cms_preview=tok");
    expect(asked()).toBe("/public/entries/about?preview=tok");
    expect([response.headers.get("Cache-Control"), response.headers.get("X-Robots-Tag")]).toEqual([
      "no-store",
      "noindex",
    ]);
  });
});

describe("headers", () => {
  it("sends the headers the loader chose", async () => {
    const { headers } = await server();
    const loaderHeaders = new Headers({ "Cache-Control": "no-store" });
    expect(headers({ loaderHeaders })).toBe(loaderHeaders);
  });
});

describe("createRootLoader", () => {
  const menu = {
    name: "Main",
    handle: "main-menu",
    items: [{ label: "About", url: "/pages/about", kind: "entry", entry: null, children: [] }],
  };
  const fallback = [{ label: "Home", to: "/" }];

  it("loads the menu's links", async () => {
    fetchSpy.mockResolvedValue(json(menu));
    const { createRootLoader } = await server();
    const result = await createRootLoader({ menu: "main-menu", fallback })({
      request: new Request("http://site.test/"),
    });
    expect(asked()).toBe("/public/menus/main-menu");
    expect(result.ace.menuLinks).toEqual([{ label: "About", to: "/pages/about" }]);
  });

  it("uses the fallback for a menu the site doesn't have, and when the CMS is down", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { createRootLoader } = await server();
    const loader = createRootLoader({ menu: "main-menu", fallback });
    fetchSpy.mockResolvedValue(json({ error: "menu not found" }, 404));
    expect((await loader({ request: new Request("http://site.test/") })).ace.menuLinks).toEqual(fallback);
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    expect((await loader({ request: new Request("http://site.test/") })).ace.menuLinks).toEqual(fallback);
    quiet.mockRestore();
  });

  it("knows the admin origin only for a preview", async () => {
    fetchSpy.mockResolvedValue(json(menu));
    const { createRootLoader } = await server();
    const loader = createRootLoader({ menu: "main-menu" });
    expect((await loader({ request: new Request("http://site.test/pages/about") })).ace.previewAdminOrigin).toBeNull();
    expect(
      (await loader({ request: new Request("http://site.test/pages/about?cms_preview=tok") })).ace.previewAdminOrigin,
    ).toBe("http://localhost:5173");
  });
});

describe("getMenuLinks", () => {
  it("gives the links, or the fallback", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getMenuLinks } = await server();
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getMenuLinks("main", { fallback: [{ label: "Home", to: "/" }] })).toEqual([
      { label: "Home", to: "/" },
    ]);
    expect(await getMenuLinks("main")).toEqual([]);
    quiet.mockRestore();
  });
});

describe("in the browser", () => {
  it("says plainly that it is server-only, instead of failing with a puzzling error", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    vi.stubGlobal("process", undefined);
    await expect(import("./server")).rejects.toThrow(/server-only.*not in a component/s);
  });

  it("loads fine on a server, even one that has a window (a test environment)", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    await expect(import("./server")).resolves.toHaveProperty("createPageLoader");
  });
});

describe("the sitemap and robots loaders", () => {
  it("answer with the site's pages as XML and a robots.txt that names them", async () => {
    const { createSitemapLoader, createRobotsLoader } = await server();
    fetchSpy.mockResolvedValue(json([{ path: "/pages/about", updated_at: "2026-10-01T09:30:00Z" }]));
    const sitemap = (await createSitemapLoader({ origin: "https://www.example.com" })({
      request: new Request("http://site.test/sitemap.xml"),
    })) as Response;
    expect(asked()).toBe("/public/sitemap");
    expect(await sitemap.text()).toContain("<loc>https://www.example.com/pages/about</loc>");
    const robots = createRobotsLoader({ disallowAll: true })({ request: new Request("http://site.test/robots.txt") });
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
