// What an Astro page or component calls. It uses the settings the integration declares, so there is no client to
// create: `import { getMenuLinks } from "@sandboxsonny/ace-kit/astro"` and use it.
import { ACE_API_URL, ACE_SITE_DOMAIN } from "astro:env/server";

import { createAceClient } from "../client/create-client";
import { loadMenuLinks } from "../helpers/menus";
import { loadPage } from "../helpers/page";
import { robotsResponse, sitemapResponse } from "../helpers/sitemap";
import type { RobotsOptions } from "../helpers/sitemap";
import type { AceNavigationLink } from "../types/menus";
import type { AcePage } from "../types/page";

/** The client for this site, made from the integration's settings. Most pages only need the functions below. */
export const ace = createAceClient({ apiUrl: ACE_API_URL, siteDomain: ACE_SITE_DOMAIN });

/** One live entry of a content type by its handle, or `null`. See `createAceClient`. */
export const getEntry = ace.getEntry;

/** A content type's live entries, newest first. */
export const getEntries = ace.getEntries;

/** A navigation menu with every link worked out, or `null`. */
export const getMenu = ace.getMenu;

/** The site: its name and the social image its owners chose (`social_image`, or `null`). */
export const getSite = ace.getSite;

/**
 * A menu's links, ready to draw: `[{ label, to, children? }]`. If the site has no such menu, or the CMS can't be
 * reached, you get `fallback` instead, so a missing menu never takes a page down.
 *
 *     const links = await getMenuLinks("main-menu", { fallback: [{ label: "Home", to: "/" }] });
 */
export function getMenuLinks(
  handle: string,
  options: { fallback?: AceNavigationLink[] } = {},
): Promise<AceNavigationLink[]> {
  return loadMenuLinks(ace, handle, options.fallback ?? []);
}

/** Puts a page's status and headers (no caching or indexing for previews, and so on) on Astro's response. */
export function applyPage(
  response: { status?: number; headers: Headers },
  page: { status: number; headers: Record<string, string> },
): void {
  response.status = page.status;
  for (const [name, value] of Object.entries(page.headers)) response.headers.set(name, value);
}

/**
 * What to show for the page being requested, from the address alone (any catch-all route will do). It also sets
 * the response's status and headers. Only a redirect is left to you, because Astro makes only a page do that:
 *
 *     const page = await getPage(Astro);
 *     if (page.kind === "redirect") return Astro.redirect(page.location, page.status);
 *
 * `page.kind` is `entry` (see `page.entry`), `not-found`, `unavailable`, `preview-expired` or `redirect`.
 */
export async function getPage<Values = Record<string, unknown>>(astro: {
  url: URL;
  response: { status?: number; headers: Headers };
}): Promise<AcePage<Values>> {
  const slug = astro.url.pathname.replace(/^\/+|\/+$/g, "");
  const page = await loadPage<Values>(ace, { slug, url: astro.url });
  applyPage(astro.response, page);
  return page;
}

/**
 * The response for `/sitemap.xml`: the site's live pages (of the content types that have pages), with when each last
 * changed. Make `src/pages/sitemap.xml.ts` with
 *
 *     import { getSitemapResponse } from "@sandboxsonny/ace-kit/astro";
 *     export const GET = ({ url }) => getSitemapResponse({ url });
 *
 * The addresses use https unless the site is on localhost; pass `{ origin: "https://example.com" }` to choose.
 */
export const getSitemapResponse = (astro: { url: URL }, options: { origin?: string } = {}) =>
  sitemapResponse(ace, astro.url, options);

/**
 * The response for `/robots.txt`, which lets crawlers in and points them at the sitemap. Make `src/pages/robots.txt.ts`
 * with
 *
 *     import { getRobotsResponse } from "@sandboxsonny/ace-kit/astro";
 *     export const GET = ({ url }) => getRobotsResponse({ url });
 *
 * Pass `{ disallowAll: true }` for a site that isn't live yet.
 */
export const getRobotsResponse = (astro: { url: URL }, options: RobotsOptions = {}) =>
  robotsResponse(astro.url, options);
