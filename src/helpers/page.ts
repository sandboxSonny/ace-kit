import { AcePreviewExpiredError, AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";
import type { AceEntry } from "../types/entries";
import type { AcePage } from "../types/page";
import { addressFromPath, isHomeAddress } from "./addressing";
import { previewHeaders, previewTokenFrom } from "./preview";
import { robotsDirectives, robotsFlags } from "./seo";

/**
 * Works out what to do for a request: which entry to show, where to redirect, or which message to give. It does
 * the same for every framework, so a route only has to act on the answer.
 *
 * - `slug` is the part of the path after the site's root, e.g. "pages/about" ("" or undefined for the home page).
 * - `url` is the full request address; it carries the preview token the CMS puts in its preview frame.
 *
 * Addresses are `/{content type}/{entry}` as on Shopify, and `/` is the home entry. An address with no page is
 * redirected if the site's owners set up a redirect for it (in the CMS), and otherwise not found. A page shown with a preview
 * token is never cached or indexed (the answer's `headers` say so).
 */
export async function loadPage<Values = Record<string, unknown>>(
  client: AceClient,
  { slug, url }: { slug: string | undefined; url: URL },
): Promise<AcePage<Values>> {
  const address = addressFromPath(slug);
  const previewToken = previewTokenFrom(url);
  const headers = previewToken ? { ...previewHeaders } : {};

  // The home entry has one address, "/". The preview token travels with the redirect; such a redirect is not worth remembering.
  if (slug && address && isHomeAddress(address)) {
    return { kind: "redirect", status: url.search ? 302 : 301, location: `/${url.search}`, headers };
  }
  if (!address) return notFoundOrRedirect(client, url, previewToken, headers);

  try {
    const entry = (await client.getEntry(address.contentTypeHandle, address.entryHandle, {
      previewToken,
    })) as AceEntry<Values> | null;
    return entry
      ? { kind: "entry", status: 200, entry, headers: withRobotsHeader(entry, headers) }
      : notFoundOrRedirect(client, url, previewToken, headers);
  } catch (error) {
    if (error instanceof AcePreviewExpiredError) return { kind: "preview-expired", status: 403, headers };
    if (error instanceof AceUnavailableError) {
      console.error(error.message);
      return { kind: "unavailable", status: 503, headers };
    }
    throw error;
  }
}

/**
 * Adds `X-Robots-Tag` for an entry whose "noindex" or "nofollow" checkbox is ticked (the same as its meta tag, and
 * it covers a page whose layout leaves `<AceSeo>` out). A preview already says noindex, so it only gains nofollow.
 */
function withRobotsHeader(entry: AceEntry<unknown>, headers: Record<string, string>): Record<string, string> {
  const flags = robotsFlags(entry as { values?: Record<string, unknown> });
  const directives = robotsDirectives({ ...flags, noindex: flags.noindex || headers["X-Robots-Tag"] === "noindex" });
  return directives ? { ...headers, "X-Robots-Tag": directives } : headers;
}

/**
 * For an address with no page: the redirect the site's owners set up for it, or a plain not found. A page shown in
 * the CMS's preview frame is never redirected, so what an editor is looking at is what they get.
 */
async function notFoundOrRedirect<Values>(
  client: AceClient,
  url: URL,
  previewToken: string | null,
  headers: Record<string, string>,
): Promise<AcePage<Values>> {
  if (previewToken) return { kind: "not-found", status: 404, headers };
  try {
    const redirect = await client.getRedirect(`${url.pathname}${url.search}`);
    if (redirect) return { kind: "redirect", status: redirect.status, location: redirect.to, headers };
  } catch (error) {
    if (!(error instanceof AceUnavailableError)) throw error;
    console.error(error.message);
    return { kind: "unavailable", status: 503, headers };
  }
  return { kind: "not-found", status: 404, headers };
}
