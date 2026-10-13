import { envField } from "astro/config";
import type { AstroIntegration } from "astro";

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
 * | `ACE_API_URL`              | `http://localhost:8080` | where the CMS Ace API lives                              |
 * | `ACE_SITE_DOMAIN`          | `localhost`             | the domain this site has in the CMS                      |
 * | `ACE_PREVIEW_ADMIN_ORIGIN` | `http://localhost:5173` | where the CMS admin app runs (may frame the site)        |
 */
export default function ace(): AstroIntegration {
  return {
    name: "ace-kit",
    hooks: {
      "astro:config:setup": ({ updateConfig, addMiddleware }) => {
        updateConfig({
          env: {
            schema: {
              // "secret" only because Astro reads secrets when the server starts, while "public" values are baked into the build.
              ACE_API_URL: envField.string({ context: "server", access: "secret", default: "http://localhost:8080" }),
              ACE_SITE_DOMAIN: envField.string({ context: "server", access: "secret", default: "localhost" }),
              ACE_PREVIEW_ADMIN_ORIGIN: envField.string({
                context: "server",
                access: "secret",
                default: "http://localhost:5173",
              }),
            },
          },
          // The kit reads those settings through `astro:env`, which only Vite understands, so Vite must process the
          // kit itself rather than leave it to Node.
          vite: { ssr: { noExternal: ["@sandboxsonny/ace-kit"] }, plugins: [sectionSync()] },
        });
        addMiddleware({ entrypoint: "@sandboxsonny/ace-kit/astro/middleware", order: "pre" });
      },
    },
  };
}
