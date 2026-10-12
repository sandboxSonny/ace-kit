/**
 * This site's settings, read from the environment when first needed (so one build runs anywhere):
 *
 * | Variable                   | Default                 | Meaning                                              |
 * | -------------------------- | ----------------------- | ---------------------------------------------------- |
 * | `ACE_API_URL`              | `http://localhost:8080` | where the CMS Ace API lives                          |
 * | `ACE_SITE_DOMAIN`          | `localhost`             | the domain this site has in the CMS (port ignored)   |
 * | `ACE_PREVIEW_ADMIN_ORIGIN` | `http://localhost:5173` | where the CMS admin app runs (may frame this site)   |
 */
export function getAceSettings() {
  return {
    apiUrl: process.env.ACE_API_URL ?? "http://localhost:8080",
    siteDomain: process.env.ACE_SITE_DOMAIN ?? "localhost",
    previewAdminOrigin: process.env.ACE_PREVIEW_ADMIN_ORIGIN ?? "http://localhost:5173",
  };
}
