import { AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";
import type { AceSitemapEntry } from "../types/sitemap";

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * The address a visitor reached the site at, for the full addresses in a sitemap. A site on a real domain is served
 * over https, but behind a proxy the server often sees plain http, so anything that isn't `localhost` or an IP address
 * is given https. Pass `origin` to the response helpers to choose it yourself.
 */
export function publicOrigin(url: URL): string {
  const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || /^[\d.]+$|:/.test(url.hostname);
  return local ? url.origin : `https://${url.host}`;
}

/** The sitemap file for a site: one `<url>` per page, with when it last changed. `origin` is e.g. `https://example.com`. */
export function sitemapXml(entries: AceSitemapEntry[], origin: string): string {
  const base = origin.replace(/\/+$/, "");
  const urls = entries
    .map((entry) => {
      const lastChanged = Number.isNaN(Date.parse(entry.updated_at)) ? "" : new Date(entry.updated_at).toISOString();
      return `  <url>\n    <loc>${escapeXml(`${base}${entry.path}`)}</loc>${
        lastChanged ? `\n    <lastmod>${lastChanged}</lastmod>` : ""
      }\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${urls ? "\n" : ""}</urlset>\n`;
}

export type RobotsOptions = {
  /** Asks every crawler to stay away, for a site that isn't live yet. */
  disallowAll?: boolean;
  /** The site's address, e.g. `https://example.com`. Left out, the address the request came to is used. */
  origin?: string;
};

/** The `robots.txt` for a site: everything may be crawled, and the sitemap is pointed at. */
export function robotsTxt({ origin, disallowAll = false }: { origin: string; disallowAll?: boolean }): string {
  if (disallowAll) return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin.replace(/\/+$/, "")}/sitemap.xml\n`;
}

/**
 * The response for `/sitemap.xml`: the site's live pages from the CMS. If the CMS can't be reached it answers 503, so a
 * crawler tries again later instead of reading an empty sitemap.
 */
export async function sitemapResponse(
  client: AceClient,
  url: URL,
  options: { origin?: string } = {},
): Promise<Response> {
  try {
    const entries = await client.getSitemap();
    return new Response(sitemapXml(entries, options.origin ?? publicOrigin(url)), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    if (!(error instanceof AceUnavailableError)) throw error;
    console.error(error.message);
    return new Response("The sitemap is unavailable right now.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" },
    });
  }
}

/** The response for `/robots.txt`. */
export function robotsResponse(url: URL, options: RobotsOptions = {}): Response {
  return new Response(robotsTxt({ origin: options.origin ?? publicOrigin(url), disallowAll: options.disallowAll }), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
