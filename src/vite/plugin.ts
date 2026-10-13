import { resolve } from "node:path";

import { loadEnv } from "vite";
import type { Plugin, UserConfig } from "vite";

import { packageName } from "../helpers/package-name";
import { startSectionSync } from "./section-sync";

/**
 * A Vite plugin for sites whose server code reads Ace Kit's settings (`ACE_API_URL`, `ACE_SITE_DOMAIN`,
 * `ACE_PREVIEW_ADMIN_ORIGIN`) from the environment, as the React Router adapter does. Vite only puts variables
 * that start with `VITE_` into the code it runs, so without this a `.env` file would not reach the server in
 * development. This reads the `ACE_` variables from `.env` files into `process.env`, never replacing one that is
 * already set, and never exposing them to the browser. In production the host's environment is used as it is.
 * It also makes sure the site uses a single copy of React and React Router, in the app and in its tests: add it to
 * `vitest.config.ts` too if the site tests components that use the kit. And while the dev server runs it syncs the
 * site's section types (its `*.schema.ts` files) to the CMS whenever they change; see `ace-kit sync`.
 *
 *     // vite.config.ts
 *     export default defineConfig({ plugins: [ace(), reactRouter()] });
 */
export default function ace(): Plugin {
  return {
    name: "ace-kit",
    configureServer(server) {
      startSectionSync(server);
    },
    config(config, { mode }) {
      const root = config.root ? resolve(config.root) : process.cwd();
      const fromFiles = loadEnv(mode, root, "ACE_");
      for (const [name, value] of Object.entries(fromFiles)) {
        if (process.env[name] === undefined) process.env[name] = value;
      }
      // One copy of React and React Router, even if the kit sits somewhere with its own (a linked or monorepo
      // install): two copies break hooks ("Cannot read properties of null (reading 'useContext')").
      //
      // In tests, Vitest runs a site's own code itself but leaves packages in node_modules to Node, so the kit
      // would load its own React Router while the test renders with another. Having Vitest run the kit too makes
      // them one. (Vite ignores `test`; Vitest reads it.)
      return {
        resolve: { dedupe: ["react", "react-dom", "react-router"] },
        test: { server: { deps: { inline: [packageName] } } },
      } as UserConfig;
    },
  };
}
