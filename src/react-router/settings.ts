import { hostedAdminOrigin, hostedApiUrl } from "../helpers/platform";

/**
 * This site's settings, read from the environment when first needed (so one build runs anywhere):
 *
 * | Variable                   | Default                 | Meaning                                              |
 * | -------------------------- | ----------------------- | ---------------------------------------------------- |
 * | `ACE_API_URL`              | `https://api.ace-cms.co.uk` | where the CMS Ace API lives (set it for a CMS on your machine) |
 * | `ACE_SITE_DOMAIN`          | `localhost`                 | the domain this site has in the CMS (port ignored)             |
 * | `ACE_PREVIEW_ADMIN_ORIGIN` | `https://app.ace-cms.co.uk` | where the CMS admin app runs (may frame this site)             |
 */
export function getAceSettings() {
  return {
    apiUrl: process.env.ACE_API_URL ?? hostedApiUrl,
    siteDomain: process.env.ACE_SITE_DOMAIN ?? "localhost",
    previewAdminOrigin: process.env.ACE_PREVIEW_ADMIN_ORIGIN ?? hostedAdminOrigin,
  };
}
