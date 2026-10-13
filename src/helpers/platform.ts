/** Where CMS Ace is hosted. There is one hosted platform, so a site never has to say where it is. */
export const hostedApiUrl = "https://api.ace-cms.co.uk";

/** Where the hosted admin app runs, which is the only origin allowed to frame a site for live preview. */
export const hostedAdminOrigin = "https://app.ace-cms.co.uk";

/**
 * The domain a site has in the CMS, from how a person wrote it: a bare domain ("example.com"), or a web address
 * ("https://example.com/about", as Astro's own `site` setting is written). A port is dropped, as the CMS ignores it.
 */
export function domainFromSite(site: string): string {
  const trimmed = site.trim();
  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }
  return trimmed.replace(/\/.*$/, "").replace(/:\d+$/, "").toLowerCase();
}
