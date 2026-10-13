import { loadEnv } from "vite";

import { chooseLoginStore } from "../auth/choose-store";
import { normaliseApiUrl } from "../auth/login-store";
import { runCommand } from "../cli/environment";
import { findOrCreateDevSite } from "./find-or-create";
import { prepareDevSite } from "./prepare-dev-site";
import type { LoginStore } from "../auth/login-store";

/** Where the dev server tells the person what it is doing. */
export type DevSiteLog = { info: (text: string) => void; warn: (text: string) => void };

/** A dev site the dev server is working on. */
export type DevSiteSession = {
  /** The domain the site now reads from, which is also what section sync targets. */
  domain: string;
  /** Tells the CMS where the dev server is running, so its live preview shows this dev server. */
  setPreviewUrl: (previewUrl: string) => Promise<void>;
};

export type StartDevSiteOptions = {
  /** The site's folder, for its .env files. */
  root: string;
  mode: string;
  log: DevSiteLog;
  /** Replaced in tests. */
  environment?: {
    variables: Record<string, string | undefined>;
    store: LoginStore;
    now: () => number;
    fetchImplementation: typeof fetch;
  };
};

const defaultApiUrl = "http://localhost:8080";

/**
 * Called when a dev server starts. If the site works against a hosted CMS (or ACE_DEV_SITE=true), gets the
 * developer's private dev site of it and points the process at it: ACE_SITE_DOMAIN becomes the dev site's domain, so
 * the site reads its dev copy, and ACE_DEV_SITE_ACTIVE tells the section sync that it is safe to sync to a hosted CMS.
 * Anything that stops this (not signed in, not allowed, the CMS unreachable) is said once, and the dev server carries
 * on with the settings it was given. Returns null when there is no dev site.
 */
export async function startDevSite(options: StartDevSiteOptions): Promise<DevSiteSession | null> {
  const { root, mode, log } = options;
  // A site's own tests start a dev server too, and must not reach out to a CMS.
  if (mode === "test" || process.env.VITEST) return null;

  const variables = options.environment?.variables ?? { ...loadEnv(mode, root, "ACE_"), ...process.env };
  let apiUrl: string;
  try {
    apiUrl = normaliseApiUrl(variables.ACE_API_URL ?? defaultApiUrl);
  } catch {
    return null; // the site's own settings are wrong; the site will say so
  }
  const environment = options.environment ?? {
    variables,
    store: await chooseLoginStore({ platform: process.platform, variables, run: runCommand }),
    now: Date.now,
    fetchImplementation: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  };

  const outcome = await prepareDevSite({ apiUrl, ...environment });
  switch (outcome.kind) {
    case "off":
      return null;
    case "waiting-for-login":
      log.warn(
        `You are not signed in to ${outcome.apiUrl}, so this is showing the live site and section sync is off. ` +
          `Run: npx ace-kit login --api-url ${outcome.apiUrl}`,
      );
      return null;
    case "problem":
      log.warn(`No dev site: ${outcome.message} Showing the live site, and section sync is off.`);
      return null;
    case "ready": {
      process.env.ACE_SITE_DOMAIN = outcome.site.domain;
      process.env.ACE_DEV_SITE_ACTIVE = "1";
      log.info(
        outcome.created
          ? `Made you a dev site, "${outcome.site.name}", as a copy of the live site (${outcome.site.domain}). ` +
              "This dev server reads and syncs to it; the live site is not touched."
          : `Using your dev site, "${outcome.site.name}" (${outcome.site.domain}). The live site is not touched.`,
      );
      const siteDomain = variables.ACE_SITE_DOMAIN?.trim() || "localhost";
      return {
        domain: outcome.site.domain,
        setPreviewUrl: async (previewUrl) => {
          const login = environment.variables.ACE_TOKEN?.trim()
            ? { token: environment.variables.ACE_TOKEN.trim() }
            : await environment.store.read(apiUrl);
          if (!login) return;
          const result = await findOrCreateDevSite({
            apiUrl,
            siteDomain,
            token: login.token,
            previewUrl,
            fetchImplementation: environment.fetchImplementation,
          });
          if (result.kind !== "found" && result.kind !== "created") {
            log.warn(
              "Could not tell the CMS where this dev server runs, so its live preview may show another address.",
            );
          }
        },
      };
    }
  }
}
