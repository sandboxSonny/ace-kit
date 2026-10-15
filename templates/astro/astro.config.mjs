// @ts-check
import { defineConfig } from "astro/config";

import node from "@astrojs/node";
import ace from "@sandboxsonny/ace-kit/astro/integration";

// https://astro.build/config
export default defineConfig({
  // The site's domain in CMS Ace. Ace Kit reads it from here (ACE_SITE_DOMAIN, if set, wins), so the dev server can find
  // or make your own private copy of this site to work on.
  site: "https://example.adamsdevelopment.co.uk",
  // Pages are rendered on each request so they always show the CMS's live content.
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Ace Kit connects the site to CMS Ace: it declares ACE_API_URL, ACE_SITE_DOMAIN and ACE_PREVIEW_ADMIN_ORIGIN, and
  // lets the CMS's admin app frame the site for live preview.
  integrations: [ace()],
});
