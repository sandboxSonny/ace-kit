// The settings the Ace integration declares with Astro (see integration.ts). Astro generates the real module in a
// site; this lets the kit's own code type-check without one.
declare module "astro:env/server" {
  export const ACE_API_URL: string;
  export const ACE_SITE_DOMAIN: string;
  export const ACE_PREVIEW_ADMIN_ORIGIN: string;
}
