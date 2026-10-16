import type { AceClientOptions } from "../types/client";
import type { AceContentTypeSchema } from "../types/content-types";
import type { AceContentTypeHandle, AceEntry, AceValuesOf } from "../types/entries";
import type { AceMenu } from "../types/menus";
import type { AceRedirect } from "../types/redirects";
import type { AceSite } from "../types/site";
import type { AceSitemapEntry } from "../types/sitemap";
import { AcePreviewExpiredError, AceUnavailableError } from "./errors";

const requestTimeoutMilliseconds = 5000;

/**
 * Most answers kept at once. Addresses come from visitors, so without a limit a stream of made-up ones (each a
 * different entry that doesn't exist) would fill the server's memory.
 */
export const maximumCachedAnswers = 500;

/**
 * A client for the CMS Ace public API. It runs on the server only, so the visitor's browser never talks to the
 * API. The API finds the site from X-Ace-Site-Domain, which this client sets to the site's domain. X-Forwarded-Host
 * is sent too, for an API that predates the first (some platforms' proxies rewrite X-Forwarded-Host on the way in).
 */
export function createAceClient({
  apiUrl,
  siteDomain,
  cacheSeconds = 5,
  fetchImplementation = (input, init) => fetch(input, init),
  now = Date.now,
}: AceClientOptions) {
  const cache = new Map<string, { expiresAt: number; value: unknown }>();

  /** Makes room: drops every answer that has run out, and if that isn't enough, the oldest. */
  function forgetSomeAnswers() {
    for (const [path, answer] of cache) if (answer.expiresAt <= now()) cache.delete(path);
    for (const path of cache.keys()) {
      if (cache.size < maximumCachedAnswers) break;
      cache.delete(path);
    }
  }

  /** Fetches a path, returning its JSON or null for a 404. Answers are reused briefly. */
  async function get<Found>(path: string, options: { cached: boolean } = { cached: true }): Promise<Found | null> {
    const cached = options.cached ? cache.get(path) : undefined;
    if (cached && cached.expiresAt > now()) return cached.value as Found | null;

    let response: Response;
    try {
      response = await fetchImplementation(`${apiUrl.replace(/\/+$/, "")}${path}`, {
        headers: { Accept: "application/json", "X-Ace-Site-Domain": siteDomain, "X-Forwarded-Host": siteDomain },
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
    } catch {
      throw new AceUnavailableError("Could not reach the CMS.");
    }

    let value: Found | null = null;
    if (response.status === 404) {
      const reply = (await response.json().catch(() => ({}))) as { error?: unknown };
      // A 404 can mean the site itself is not set up, which is a mistake to report, not a missing page.
      if (reply.error === "no site for this domain") {
        throw new AceUnavailableError(`The CMS has no site with the domain "${siteDomain}".`);
      }
    } else if (response.status === 403 && !options.cached) {
      throw new AcePreviewExpiredError();
    } else if (response.ok) {
      value = (await response.json().catch(() => {
        throw new AceUnavailableError("The CMS sent a reply that could not be read.");
      })) as Found;
    } else {
      throw new AceUnavailableError(`The CMS answered with an error (${response.status}).`);
    }

    if (options.cached && cacheSeconds > 0) {
      if (cache.size >= maximumCachedAnswers) forgetSomeAnswers();
      cache.set(path, { expiresAt: now() + cacheSeconds * 1000, value });
    }
    return value;
  }

  return {
    /**
     * One live entry of a content type, by its handle; null if the site has no such entry. With a preview token the
     * entry the token was made for comes back with its draft applied (never cached); a token that has run out throws
     * AcePreviewExpiredError.
     */
    async getEntry<Handle extends AceContentTypeHandle>(
      contentTypeHandle: Handle,
      handle: string,
      options: { previewToken?: string | null } = {},
    ): Promise<AceEntry<AceValuesOf<Handle>> | null> {
      const path = `/public/entries/${encodeURIComponent(handle)}`;
      const entry = options.previewToken
        ? await get<AceEntry<AceValuesOf<Handle>>>(`${path}?preview=${encodeURIComponent(options.previewToken)}`, {
            cached: false,
          })
        : await get<AceEntry<AceValuesOf<Handle>>>(path);
      // Entry handles are unique across a site, so the content type in the address must be the entry's own.
      return entry && entry.content_type_handle === contentTypeHandle ? entry : null;
    },

    /** The live entries of a content type, newest first. */
    async getEntries<Handle extends AceContentTypeHandle>(
      contentTypeHandle: Handle,
      options: { limit?: number } = {},
    ): Promise<AceEntry<AceValuesOf<Handle>>[]> {
      const query = new URLSearchParams({ content_type: contentTypeHandle });
      if (options.limit) query.set("limit", String(options.limit));
      return (await get<AceEntry<AceValuesOf<Handle>>[]>(`/public/entries?${query}`)) ?? [];
    },

    /** One of the site's navigation menus by its handle, with every link worked out; null if the site has none. */
    getMenu(handle: string): Promise<AceMenu | null> {
      return get<AceMenu>(`/public/menus/${encodeURIComponent(handle)}`);
    },

    /**
     * Where an address the site has no page for should redirect to, if the site's owners set that up; null if not.
     * `address` is the path with its query string, e.g. "/old-page?id=7".
     */
    async getRedirect(address: string): Promise<AceRedirect | null> {
      const redirect = await get<AceRedirect>(`/public/redirects?from=${encodeURIComponent(address)}`);
      // Only ever send a visitor to a path on the site or a web address, whatever the CMS says.
      const goesSomewhereSafe =
        redirect !== null &&
        typeof redirect.to === "string" &&
        ((redirect.to.startsWith("/") && !redirect.to.startsWith("//") && !redirect.to.includes("\\")) ||
          /^https?:\/\/[^\s]+$/i.test(redirect.to)) &&
        (redirect.status === 301 || redirect.status === 302);
      return goesSomewhereSafe ? redirect : null;
    },

    /** The site's live pages for its sitemap, by path. Pages of content types that have no pages of their own are left out. */
    async getSitemap(): Promise<AceSitemapEntry[]> {
      return (await get<AceSitemapEntry[]>("/public/sitemap")) ?? [];
    },

    /** The site itself: its name, and the social image its owners chose (null if none). */
    getSite(): Promise<AceSite | null> {
      return get<AceSite>("/public/site");
    },

    /** What the site's content types and fields are, which is what type generation reads. */
    async getContentTypes(): Promise<AceContentTypeSchema[]> {
      return (await get<AceContentTypeSchema[]>("/public/content-types")) ?? [];
    },
  };
}

/** The client `createAceClient` returns. */
export type AceClient = ReturnType<typeof createAceClient>;
