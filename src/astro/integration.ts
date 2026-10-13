import { envField } from "astro/config";
import type { AstroIntegration } from "astro";

import { fileURLToPath } from "node:url";

import { domainFromSite, hostedAdminOrigin, hostedApiUrl } from "../helpers/platform";
import { startDevSite } from "../dev-site/start-dev-site";
import type { DevSiteSession } from "../dev-site/start-dev-site";
import sectionSync from "../vite/section-sync";

/**
 * The Astro integration. Add it once to `astro.config.mjs` and a site is wired up:
 *
 *     import ace from "@sandboxsonny/ace-kit/astro/integration";
 *     export default defineConfig({ output: "server", integrations: [ace()] });
 *
 * It declares the three settings below, and lets the CMS's admin app (and only it) frame the site for live preview.
 * The settings are read when the server starts, not baked into the build, so one build runs anywhere. While the dev
 * server runs it also syncs the site's section types (its `*.schema.ts` files) to the CMS whenever they change; see
 * `ace-kit sync`.
 *
 * | Setting                    | Default                 | Meaning                                                  |
 * | -------------------------- | ----------------------- | -------------------------------------------------------- |
 * | `ACE_API_URL`              | `https://api.ace-cms.co.uk` | where the CMS Ace API lives (set it for a CMS on your machine) |
 * | `ACE_SITE_DOMAIN`          | the host of Astro's `site` setting, else `localhost` | the domain this site has in the CMS |
 * | `ACE_PREVIEW_ADMIN_ORIGIN` | `https://app.ace-cms.co.uk` | where the CMS admin app runs (may frame the site)  |
 */
export default function ace(): AstroIntegration {
  let devSite: DevSiteSession | null = null;
  return {
    name: "ace-kit",
    hooks: {
      "astro:config:setup": async ({ command, config, logger, updateConfig, addMiddleware }) => {
        // While the dev server runs against a hosted CMS, work on the developer's own copy of the site, not the live one.
        // The site's domain in the CMS: ACE_SITE_DOMAIN if it is set, otherwise the host of Astro's own `site` setting
        // (so `site: "https://example.com"` in the config, or `astro dev --site https://example.com`, is enough).
        const siteDomain = config.site ? domainFromSite(config.site) : "localhost";
        if (command === "dev") {
          devSite = await startDevSite({
            root: fileURLToPath(config.root),
            mode: "development",
            siteDomain,
            log: { info: (text) => logger.info(text), warn: (text) => logger.warn(text) },
          });
        }
        updateConfig({
          env: {
            schema: {
              // "secret" only because Astro reads secrets when the server starts, while "public" values are baked into the build.
              ACE_API_URL: envField.string({ context: "server", access: "secret", default: hostedApiUrl }),
              ACE_SITE_DOMAIN: envField.string({ context: "server", access: "secret", default: siteDomain }),
              ACE_PREVIEW_ADMIN_ORIGIN: envField.string({
                context: "server",
                access: "secret",
                default: hostedAdminOrigin,
              }),
            },
          },
          // The kit reads those settings through `astro:env`, which only Vite understands, so Vite must process the
          // kit itself rather than leave it to Node.
          vite: { ssr: { noExternal: ["@sandboxsonny/ace-kit"] }, plugins: [sectionSync()] },
        });
        addMiddleware({ entrypoint: "@sandboxsonny/ace-kit/astro/middleware", order: "pre" });
      },
      "astro:server:start": async ({ address }) => {
        // Tell the CMS where this dev server runs, so the live preview in its admin shows it.
        if (devSite) await devSite.setPreviewUrl(`http://localhost:${address.port}`);
      },
    },
  };
}
