import { parseArgs } from "node:util";

import { resolveLogin } from "../auth/resolve-login";
import { findFormFiles, findSchemaFiles } from "../sections/find-schemas";
import { loadForms } from "../forms/load-forms";
import { formsPayload } from "../forms/payload";
import { syncForms } from "../forms/sync";
import { loadSchemas } from "../sections/load-schemas";
import { sectionTypesPayload } from "../sections/payload";
import { syncSectionTypes } from "../sections/sync";
import { domainFromSite, hostedApiUrl } from "../helpers/platform";
import { cmsName, isLocalApiUrl, loginCommandFor } from "./api-url";
import type { CliEnvironment } from "./environment";
import { normaliseApiUrl } from "../auth/login-store";

export const syncUsage = `ace-kit sync: send the section types and forms your code defines to CMS Ace.

Usage:
  ace-kit sync [--site <domain>] [--dir <folder>]

It finds every *.schema.ts file (section types) and every *.form.ts file (forms) in the folder (src and app by default),
checks them, and makes the CMS's section types and forms for your site match. The dev server does this for you whenever
one of those files is saved; run it yourself for a one-off sync, or on a build server (with ACE_TOKEN set).

Nothing is deleted: a section type, block or field you take out of your code is kept in the CMS, hidden, so the content
written in it survives; a form you take out stops taking messages but keeps the ones it has. If any file can't be
loaded, nothing is synced.

Options:
  --site      The domain your site has in the CMS, e.g. example.com (or set ACE_SITE_DOMAIN).
              (--domain means the same.)
  --dir       The folder to look in (default: src and app).
  --help      Show this message.
`;

/** ACE_SYNC_SECTIONS: "false" (or off, no, 0) turns the dev server's automatic sync off; "remote" lets it sync to a hosted CMS. */
const isSwitchedOff = (value: string | undefined) =>
  ["false", "off", "no", "0"].includes((value ?? "").trim().toLowerCase());

export async function syncCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const { values } = parseArgs({
    // eslint-disable-next-line id-denylist -- "args" is the name node's parseArgs gives this option.
    args: commandArguments,
    options: {
      "api-url": { type: "string" },
      site: { type: "string" },
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
    apiUrl = normaliseApiUrl(values["api-url"] ?? environment.variables.ACE_API_URL ?? hostedApiUrl);
  } catch (error) {
    environment.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const given = values.site ?? values.domain ?? environment.variables.ACE_SITE_DOMAIN;
  const siteDomain = given ? domainFromSite(given) : "localhost";

  // The dev server points the process at the developer's own dev site, or at a site that hasn't launched (see
  // startDevSite): syncing to either is safe.
  const aimedAtDevSite = environment.variables.ACE_DEV_SITE_ACTIVE === "1";
  const siteBuilding = environment.variables.ACE_SITE_BUILDING === "1";
  if (
    automatic &&
    !aimedAtDevSite &&
    !siteBuilding &&
    !isLocalApiUrl(apiUrl) &&
    environment.variables.ACE_SYNC_SECTIONS?.trim().toLowerCase() !== "remote"
  ) {
    environment.out(
      `Section sync is off while ${apiUrl} is a hosted CMS, so a half-written change can't reach a live site. ` +
        "To sync on every save to it anyway, set ACE_SYNC_SECTIONS=remote. (npx ace-kit sync always works.)",
    );
    return 0;
  }

  const files = await findSchemaFiles(environment.workingDirectory, values.dir);
  const formFiles = await findFormFiles(environment.workingDirectory, values.dir);
  if (files.length === 0 && formFiles.length === 0) {
    // A site that doesn't use sections or forms is not told about them every time its dev server starts.
    if (!automatic) {
      environment.out(
        `No *.schema.ts or *.form.ts files found in ${values.dir ?? "src or app"}, so nothing was synced (syncing none would retire every section and form).`,
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
    environment.out(`Sync is waiting for you to sign in. Run: ${loginCommandFor(apiUrl)}`);
    return automatic ? 0 : 1;
  }

  const loaded = await loadSchemas(files, environment.workingDirectory, environment.importModule);
  const loadedForms = await loadForms(formFiles, environment.workingDirectory, environment.importModule);
  const problems = [...loaded.problems, ...loadedForms.problems];
  if (problems.length > 0) {
    for (const problem of problems) environment.error(problem);
    environment.error(
      "Nothing was synced, because syncing only some of your sections and forms would retire the rest.",
    );
    return 1;
  }

  const where = `${apiUrl === hostedApiUrl ? "" : ` (${apiUrl})`}`;
  let exitCode = 0;

  if (files.length > 0) {
    const outcome = await syncSectionTypes({
      apiUrl,
      siteDomain,
      token: login.token,
      payload: sectionTypesPayload(loaded.definitions.map((entry) => entry.definition)),
      fetchImplementation: environment.fetchImplementation,
    });
    if (outcome.kind === "synced") {
      const defined = outcome.sections.filter((section) => !section.retired).map((section) => section.handle);
      const retired = outcome.sections.filter((section) => section.retired).map((section) => section.handle);
      environment.out(
        `Synced ${defined.length} section type${defined.length === 1 ? "" : "s"} (${defined.join(", ")}) to ${outcome.site.domain}${where}.` +
          (retired.length > 0 ? ` No longer in your code, kept but hidden: ${retired.join(", ")}.` : ""),
      );
      for (const warning of outcome.warnings) environment.error(`Warning: ${warning}`);
    } else {
      exitCode = reportFailure(outcome, apiUrl, automatic, environment);
    }
  }

  if (formFiles.length > 0 && exitCode === 0) {
    const outcome = await syncForms({
      apiUrl,
      siteDomain,
      token: login.token,
      payload: formsPayload(loadedForms.definitions.map((entry) => entry.definition)),
      fetchImplementation: environment.fetchImplementation,
    });
    if (outcome.kind === "synced") {
      const defined = outcome.forms.filter((form) => !form.retired).map((form) => form.handle);
      const retired = outcome.forms.filter((form) => form.retired).map((form) => form.handle);
      environment.out(
        `Synced ${defined.length} form${defined.length === 1 ? "" : "s"} (${defined.join(", ")}) to ${outcome.site.domain}${where}.` +
          (retired.length > 0 ? ` No longer in your code, no longer taking messages: ${retired.join(", ")}.` : ""),
      );
    } else {
      exitCode = reportFailure(outcome, apiUrl, automatic, environment);
    }
  }
  return exitCode;
}

/** Says why a sync did not happen, and what the command should exit with. */
function reportFailure(
  outcome:
    | { kind: "login-ended" }
    | { kind: "site-not-found"; domain: string; available: string[] }
    | { kind: "forbidden"; message: string }
    | { kind: "rejected"; message: string }
    | { kind: "unreachable" },
  apiUrl: string,
  automatic: boolean,
  environment: CliEnvironment,
): number {
  switch (outcome.kind) {
    case "login-ended":
      environment.out(`Your login has ended. Run: ${loginCommandFor(apiUrl)}`);
      return automatic ? 0 : 1;
    case "site-not-found":
      environment.error(
        `${cmsName(apiUrl)} has no site with the domain "${outcome.domain}" that you can see` +
          (outcome.available.length > 0 ? ` (your sites: ${outcome.available.join(", ")})` : "") +
          ". Set ACE_SITE_DOMAIN or pass --site.",
      );
      return 1;
    case "forbidden":
    case "rejected":
      environment.error(outcome.message);
      return 1;
    case "unreachable":
      environment.error(`Could not reach ${cmsName(apiUrl)}.`);
      return 1;
  }
}
