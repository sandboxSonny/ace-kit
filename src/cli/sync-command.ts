import { parseArgs } from "node:util";

import { resolveLogin } from "../auth/resolve-login";
import { findSchemaFiles } from "../sections/find-schemas";
import { loadSchemas } from "../sections/load-schemas";
import { sectionTypesPayload } from "../sections/payload";
import { syncSectionTypes } from "../sections/sync";
import { isLocalApiUrl } from "./api-url";
import type { CliEnvironment } from "./environment";
import { normaliseApiUrl } from "../auth/login-store";

export const syncUsage = `ace-kit sync: send the section types your code defines to CMS Ace.

Usage:
  ace-kit sync [--api-url <address>] [--domain <domain>] [--dir <folder>]

It finds every *.schema.ts file in the folder (src by default), checks them, and makes the CMS's section types for your
site match. The dev server does this for you whenever a schema file is saved; run it yourself for a one-off sync, or on a
build server (with ACE_TOKEN set).

Nothing is deleted: a section type, block or field you take out of your code is kept in the CMS, hidden, so the content
written in it survives. If any schema file can't be loaded, nothing is synced.

Options:
  --api-url   Where the CMS Ace API lives (default: ACE_API_URL, else http://localhost:8080).
  --domain    The domain your site has in the CMS (default: ACE_SITE_DOMAIN, else localhost).
  --dir       The folder to look in (default: src).
  --help      Show this message.
`;

const defaultApiUrl = "http://localhost:8080";

/** ACE_SYNC_SECTIONS: "false" (or off, no, 0) turns the dev server's automatic sync off; "remote" lets it sync to a hosted CMS. */
const isSwitchedOff = (value: string | undefined) =>
  ["false", "off", "no", "0"].includes((value ?? "").trim().toLowerCase());

export async function syncCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const { values } = parseArgs({
    // eslint-disable-next-line id-denylist -- "args" is the name node's parseArgs gives this option.
    args: commandArguments,
    options: {
      "api-url": { type: "string" },
      domain: { type: "string" },
      dir: { type: "string" },
      // Set by the dev server, which syncs on its own: it stays quiet when there is nothing to do, and keeps to a
      // local CMS unless told otherwise.
      automatic: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    environment.out(syncUsage);
    return 0;
  }
  const automatic = values.automatic === true;
  if (automatic && isSwitchedOff(environment.variables.ACE_SYNC_SECTIONS)) return 0;

  // The same defaults the Astro integration uses for the site itself, so the sync goes where the site reads from.
  // (Not the address last signed in to: that may be a hosted CMS the site isn't pointed at.)
  let apiUrl: string;
  try {
    apiUrl = normaliseApiUrl(values["api-url"] ?? environment.variables.ACE_API_URL ?? defaultApiUrl);
  } catch (error) {
    environment.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const siteDomain = values.domain ?? environment.variables.ACE_SITE_DOMAIN ?? "localhost";

  if (
    automatic &&
    !isLocalApiUrl(apiUrl) &&
    environment.variables.ACE_SYNC_SECTIONS?.trim().toLowerCase() !== "remote"
  ) {
    environment.out(
      `Section sync is off while ${apiUrl} is a hosted CMS, so a half-written change can't reach a live site. ` +
        "To sync on every save to it anyway, set ACE_SYNC_SECTIONS=remote. (npx ace-kit sync always works.)",
    );
    return 0;
  }

  const files = await findSchemaFiles(environment.workingDirectory, values.dir ?? "src");
  if (files.length === 0) {
    // A site that doesn't use sections is not told about them every time its dev server starts.
    if (!automatic) {
      environment.out(
        `No *.schema.ts files found in ${values.dir ?? "src"}, so nothing was synced (syncing none would retire every section).`,
      );
    }
    return 0;
  }

  const login = await resolveLogin({
    apiUrl,
    variables: environment.variables,
    store: environment.store,
    now: environment.now,
  });
  if (!login) {
    environment.out(`Section sync is waiting for you to sign in. Run: npx ace-kit login --api-url ${apiUrl}`);
    return automatic ? 0 : 1;
  }

  const loaded = await loadSchemas(files, environment.workingDirectory, environment.importModule);
  if (loaded.problems.length > 0) {
    for (const problem of loaded.problems) environment.error(problem);
    environment.error("Nothing was synced, because syncing only some of your sections would retire the rest.");
    return 1;
  }

  const outcome = await syncSectionTypes({
    apiUrl,
    siteDomain,
    token: login.token,
    payload: sectionTypesPayload(loaded.definitions.map((entry) => entry.definition)),
    fetchImplementation: environment.fetchImplementation,
  });

  switch (outcome.kind) {
    case "synced": {
      const defined = outcome.sections.filter((section) => !section.retired).map((section) => section.handle);
      const retired = outcome.sections.filter((section) => section.retired).map((section) => section.handle);
      environment.out(
        `Synced ${defined.length} section type${defined.length === 1 ? "" : "s"} (${defined.join(", ")}) to ${outcome.site.domain} (${apiUrl}).` +
          (retired.length > 0 ? ` No longer in your code, kept but hidden: ${retired.join(", ")}.` : ""),
      );
      for (const warning of outcome.warnings) environment.error(`Warning: ${warning}`);
      return 0;
    }
    case "login-ended":
      environment.out(`Your login has ended. Run: npx ace-kit login --api-url ${apiUrl}`);
      return automatic ? 0 : 1;
    case "site-not-found":
      environment.error(
        `The CMS at ${apiUrl} has no site with the domain "${outcome.domain}" that you can see` +
          (outcome.available.length > 0 ? ` (your sites: ${outcome.available.join(", ")})` : "") +
          ". Set ACE_SITE_DOMAIN or pass --domain.",
      );
      return 1;
    case "forbidden":
    case "rejected":
      environment.error(outcome.message);
      return 1;
    case "unreachable":
      environment.error(`Could not reach the CMS at ${apiUrl}.`);
      return 1;
  }
}
