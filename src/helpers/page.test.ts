import { describe, expect, it, vi } from "vitest";

import { loadPage } from "./page";
import { AcePreviewExpiredError, AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";

const entry = { id: 1, content_type_handle: "pages", handle: "about", title: "About", values: {} };
const url = (path: string) => new URL(`http://site.test${path}`);

function clientReturning(result: () => Promise<unknown>, redirect: () => Promise<unknown> = async () => null) {
  const getEntry = vi.fn(result);
  const getRedirect = vi.fn(redirect);
  return { client: { getEntry, getRedirect } as unknown as AceClient, getEntry, getRedirect };
}

describe("loadPage", () => {
  it("shows the entry at /{content type}/{entry}", async () => {
    const { client, getEntry } = clientReturning(async () => entry);
    const page = await loadPage(client, { slug: "pages/about", url: url("/pages/about") });
    expect(page).toEqual({ kind: "entry", status: 200, entry, headers: {} });
    expect(getEntry).toHaveBeenCalledWith("pages", "about", { previewToken: null });
  });

  it("sends X-Robots-Tag for an entry marked noindex or nofollow, and nothing otherwise", async () => {
    const flagged = (values: Record<string, unknown>) => clientReturning(async () => ({ ...entry, values })).client;
    const load = (client: AceClient, path = "/pages/about") =>
      loadPage(client, { slug: path.slice(1).split("?")[0], url: url(path) });
    expect((await load(flagged({ "seo-noindex": true }))).headers).toEqual({ "X-Robots-Tag": "noindex" });
    expect((await load(flagged({ "seo-nofollow": true }))).headers).toEqual({ "X-Robots-Tag": "nofollow" });
    expect((await load(flagged({ "seo-noindex": true, "seo-nofollow": true }))).headers).toEqual({
      "X-Robots-Tag": "noindex, nofollow",
    });
    expect((await load(flagged({ "seo-noindex": false }))).headers).toEqual({});
    // A preview is already noindex; it gains nofollow.
    const preview = await load(flagged({ "seo-nofollow": true }), "/pages/about?cms_preview=abc");
    expect(preview.headers).toEqual({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  });

  it("shows the home entry at the root", async () => {
    const { client, getEntry } = clientReturning(async () => ({ ...entry, handle: "home" }));
    const page = await loadPage(client, { slug: undefined, url: url("/") });
    expect(page.kind).toBe("entry");
    expect(getEntry).toHaveBeenCalledWith("pages", "home", { previewToken: null });
  });

  it("redirects the home entry's own address to the root, permanently unless a preview token travels along", async () => {
    const { client, getEntry } = clientReturning(async () => entry);
    expect(await loadPage(client, { slug: "pages/home", url: url("/pages/home") })).toEqual({
      kind: "redirect",
      status: 301,
      location: "/",
      headers: {},
    });
    const preview = await loadPage(client, { slug: "pages/home", url: url("/pages/home?cms_preview=abc") });
    expect(preview).toMatchObject({ kind: "redirect", status: 302, location: "/?cms_preview=abc" });
    expect(getEntry).not.toHaveBeenCalled();
  });

  it("is not found for an address that isn't a page, without asking the CMS", async () => {
    const { client, getEntry } = clientReturning(async () => entry);
    expect(await loadPage(client, { slug: "a/b/c", url: url("/a/b/c") })).toMatchObject({
      kind: "not-found",
      status: 404,
    });
    expect(getEntry).not.toHaveBeenCalled();
  });

  it("is not found when the CMS has no such entry", async () => {
    const { client } = clientReturning(async () => null);
    expect(await loadPage(client, { slug: "pages/nope", url: url("/pages/nope") })).toMatchObject({
      kind: "not-found",
    });
  });

  it("passes the preview token on and keeps the page out of caches and search engines", async () => {
    const { client, getEntry } = clientReturning(async () => entry);
    const page = await loadPage(client, { slug: "pages/about", url: url("/pages/about?cms_preview=tok") });
    expect(getEntry).toHaveBeenCalledWith("pages", "about", { previewToken: "tok" });
    expect(page.headers).toEqual({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  });

  it("says when the preview has expired", async () => {
    const { client } = clientReturning(async () => Promise.reject(new AcePreviewExpiredError()));
    const page = await loadPage(client, { slug: "pages/about", url: url("/pages/about?cms_preview=old") });
    expect(page).toMatchObject({ kind: "preview-expired", status: 403 });
    expect(page.headers["Cache-Control"]).toBe("no-store");
  });

  it("says when the CMS is unavailable, and lets other errors through", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const down = clientReturning(async () => Promise.reject(new AceUnavailableError("Could not reach the CMS.")));
    expect(await loadPage(down.client, { slug: "pages/about", url: url("/pages/about") })).toMatchObject({
      kind: "unavailable",
      status: 503,
    });
    const broken = clientReturning(async () => Promise.reject(new TypeError("a bug")));
    await expect(loadPage(broken.client, { slug: "pages/about", url: url("/pages/about") })).rejects.toThrow("a bug");
    quiet.mockRestore();
  });

  describe("redirects", () => {
    const moved = { from: "/about-us", to: "/pages/about", status: 301 };

    it("redirects an address that isn't a page when the site has a redirect for it", async () => {
      const { client, getEntry, getRedirect } = clientReturning(
        async () => entry,
        async () => moved,
      );
      const page = await loadPage(client, { slug: "about-us", url: url("/about-us?utm_source=mail") });
      expect(page).toEqual({ kind: "redirect", status: 301, location: "/pages/about", headers: {} });
      expect(getRedirect).toHaveBeenCalledWith("/about-us?utm_source=mail");
      expect(getEntry).not.toHaveBeenCalled();
    });

    it("keeps a temporary redirect temporary and can go to another site", async () => {
      const { client } = clientReturning(
        async () => null,
        async () => ({ ...moved, to: "https://shop.example.com/", status: 302 }),
      );
      expect(await loadPage(client, { slug: "pages/gone", url: url("/pages/gone") })).toMatchObject({
        kind: "redirect",
        status: 302,
        location: "https://shop.example.com/",
      });
    });

    it("looks for a redirect only once it knows there is no entry", async () => {
      const { client, getRedirect } = clientReturning(
        async () => entry,
        async () => moved,
      );
      expect((await loadPage(client, { slug: "pages/about", url: url("/pages/about") })).kind).toBe("entry");
      expect(getRedirect).not.toHaveBeenCalled();
    });

    it("is not found when there is no redirect either", async () => {
      const { client, getRedirect } = clientReturning(async () => null);
      expect(await loadPage(client, { slug: "pages/nope", url: url("/pages/nope?a=1") })).toMatchObject({
        kind: "not-found",
        status: 404,
      });
      expect(getRedirect).toHaveBeenCalledWith("/pages/nope?a=1");
    });

    it("never redirects a page shown in the CMS's preview frame", async () => {
      const { client, getRedirect } = clientReturning(
        async () => null,
        async () => moved,
      );
      const page = await loadPage(client, { slug: "pages/nope", url: url("/pages/nope?cms_preview=tok") });
      expect(page).toMatchObject({ kind: "not-found" });
      expect(getRedirect).not.toHaveBeenCalled();
    });

    it("says when the CMS can't be asked about a redirect", async () => {
      const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { client } = clientReturning(
        async () => null,
        async () => Promise.reject(new AceUnavailableError("Could not reach the CMS.")),
      );
      expect(await loadPage(client, { slug: "old", url: url("/old") })).toMatchObject({
        kind: "unavailable",
        status: 503,
      });
      quiet.mockRestore();
    });
  });
});
