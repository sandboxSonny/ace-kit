import { resolveLogin } from "../auth/resolve-login";
import type { LoginStore } from "../auth/login-store";
import { isLocalApiUrl } from "../cli/api-url";
import { findOrCreateDevSite } from "./find-or-create";
import type { DevSite } from "./find-or-create";

/** What getting the developer's dev site ready came to. */
export type PrepareOutcome =
  | { kind: "off" }
  | { kind: "ready"; site: DevSite; created: boolean }
  | { kind: "waiting-for-login"; apiUrl: string }
  | { kind: "problem"; message: string };

const off = ["false", "off", "no", "0"];
const on = ["true", "on", "yes", "1"];

/**
 * Whether the dev server works on a dev site. ACE_DEV_SITE=false switches it off and ACE_DEV_SITE=true switches it
 * on; otherwise it is on when the CMS is a hosted one, because a CMS on your own machine is already a private copy.
 */
export function wantsDevSite(variables: Record<string, string | undefined>, apiUrl: string): boolean {
  const setting = (variables.ACE_DEV_SITE ?? "").trim().toLowerCase();
  if (off.includes(setting)) return false;
  if (on.includes(setting)) return true;
  return !isLocalApiUrl(apiUrl);
}

/**
 * Gets the developer's dev site of the site the settings name, ready for the dev server to use: finds it or has the
 * CMS make it. The caller points the site at the returned domain.
 */
export async function prepareDevSite(options: {
  apiUrl: string;
  variables: Record<string, string | undefined>;
  store: LoginStore;
  now: () => number;
  fetchImplementation: typeof fetch;
}): Promise<PrepareOutcome> {
  const { apiUrl, variables, store, now, fetchImplementation } = options;
  if (!wantsDevSite(variables, apiUrl)) return { kind: "off" };

  const login = await resolveLogin({ apiUrl, variables, store, now });
  if (!login) return { kind: "waiting-for-login", apiUrl };

  const siteDomain = variables.ACE_SITE_DOMAIN?.trim() || "localhost";
  const outcome = await findOrCreateDevSite({ apiUrl, siteDomain, token: login.token, fetchImplementation });

  switch (outcome.kind) {
    case "created":
    case "found":
      return { kind: "ready", site: outcome.site, created: outcome.kind === "created" };
    case "login-ended":
      return { kind: "waiting-for-login", apiUrl };
    case "site-not-found":
      return {
        kind: "problem",
        message:
          `The CMS at ${apiUrl} has no site with the domain "${outcome.domain}" that you can see` +
          (outcome.available.length > 0 ? ` (your sites: ${outcome.available.join(", ")})` : "") +
          ". Set ACE_SITE_DOMAIN.",
      };
    case "forbidden":
      return {
        kind: "problem",
        message:
          `${outcome.message[0].toUpperCase()}${outcome.message.slice(1)}. Dev sites are for partner accounts and super admins. ` +
          "Ask for a partner account, or set ACE_DEV_SITE=false to stop trying.",
      };
    case "rejected":
      return { kind: "problem", message: outcome.message };
    case "unreachable":
      return { kind: "problem", message: `Could not reach the CMS at ${apiUrl}.` };
  }
}
