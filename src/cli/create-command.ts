import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import { normaliseApiUrl } from "../auth/login-store";
import type { StoredLogin } from "../auth/login-store";
import { resolveLogin } from "../auth/resolve-login";
import { createSite, frameworks, planSite } from "../create/create-site";
import type { Framework } from "../create/create-site";
import { createAndSeedSite } from "../create/seed-site";
import { frameworksWithSections } from "../create/starter-content";
import { hostedApiUrl } from "../helpers/platform";
import { cmsName, isLocalApiUrl } from "./api-url";
import type { CliEnvironment } from "./environment";
import { signIn } from "./login-commands";

export const createUsage = `ace-kit create: make a new site that uses CMS Ace.

Usage:
  ace-kit create <folder> <domain> [--framework astro|react-router] [--name <name>]

It signs you in if you aren't already (your browser opens to approve it), makes the site in CMS Ace with starter
content (a Pages type, Home, About and Contact, a main menu), and copies a starter site into the folder with your
site's name, domain and package name filled in. If a site with that domain already exists in CMS Ace it is left alone
and only the folder is made.

Options:
  <domain>      The domain the site has in CMS Ace, e.g. example.com. (--site <domain> means the same.)
  --framework   astro (the default) or react-router.
  --name        The name shown to visitors (default: made from the folder's name, so my-site is "My Site").
  --help        Show this message.
`;

export async function createCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const { values, positionals } = parseArgs({
    // eslint-disable-next-line id-denylist -- "args" is the name node's parseArgs gives this option.
    args: commandArguments,
    allowPositionals: true,
    options: {
      site: { type: "string" },
      framework: { type: "string" },
      name: { type: "string" },
      "api-url": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    environment.out(createUsage);
    return 0;
  }
  const [folder, domainArgument, ...extra] = positionals;
  const site = values.site ?? domainArgument;
  if (!folder || extra.length > 0 || (values.site !== undefined && domainArgument !== undefined)) {
    environment.error(`Give a folder and the site's domain.\n\n${createUsage}`);
    return 1;
  }
  if (!site) {
    environment.error(`Give the site's domain, for example: ace-kit create ${folder} example.com\n\n${createUsage}`);
    return 1;
  }
  const framework = values.framework ?? "astro";
  if (!frameworks.includes(framework as Framework)) {
    environment.error(`--framework must be ${frameworks.join(" or ")}, not "${framework}".`);
    return 1;
  }

  // Everything that can be checked is checked before anything is made, here or in the CMS.
  const options = { folder: resolve(environment.workingDirectory, folder), site, name: values.name };
  let plan;
  let apiUrl;
  try {
    plan = await planSite(options);
    apiUrl = normaliseApiUrl(values["api-url"] ?? environment.variables.ACE_API_URL ?? hostedApiUrl);
  } catch (error) {
    environment.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (apiUrl.startsWith("http://") && !isLocalApiUrl(apiUrl)) {
    environment.error(
      `Warning: ${cmsName(apiUrl)} is not encrypted (http://), so your login could be read on the way. Use https:// if you can.`,
    );
  }

  // The CMS needs to know who is making the site, and the login is the person's own, so it comes first.
  let login: Pick<StoredLogin, "token"> | null = await resolveLogin({
    apiUrl,
    variables: environment.variables,
    store: environment.store,
    now: environment.now,
  });
  if (!login) {
    try {
      login = await signIn(apiUrl, environment);
    } catch (error) {
      environment.error(`\n${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
    environment.out("");
  }

  let sectionTypes: unknown = null;
  if (frameworksWithSections.includes(framework as Framework)) {
    sectionTypes = JSON.parse(
      await readFile(join(environment.templatesDirectory, `${framework}.section-types.json`), "utf8"),
    );
  }
  // A CMS on this machine: the site runs here too, and the admin app that frames it for live preview is the local one.
  // (The hosted CMS Ace is where a site's settings default to, and a dev site sets its own preview address.)
  const onThisMachine = isLocalApiUrl(apiUrl);
  const devPort = framework === "react-router" ? 4322 : 4321;
  const seeded = await createAndSeedSite({
    apiUrl,
    token: login.token,
    name: plan.name,
    domain: plan.domain,
    previewUrl: onThisMachine ? `http://localhost:${devPort}` : undefined,
    framework: framework as Framework,
    sectionTypes,
    fetchImplementation: environment.fetchImplementation,
  });
  if (seeded.kind === "failed" && !seeded.siteMade) {
    environment.error(`Could not make the site in CMS Ace: ${seeded.message}\nNothing was made.`);
    return 1;
  }

  const created = await createSite({
    ...options,
    framework: framework as Framework,
    templatesDirectory: environment.templatesDirectory,
    environmentSettings:
      apiUrl === hostedApiUrl
        ? undefined
        : {
            ACE_API_URL: apiUrl,
            ...(onThisMachine && { ACE_PREVIEW_ADMIN_ORIGIN: "http://localhost:5173" }),
          },
    kitVersion: environment.version,
  });

  switch (seeded.kind) {
    case "seeded":
      environment.out(
        `Made ${created.domain} in ${apiUrl === hostedApiUrl ? "CMS Ace" : `CMS Ace (${apiUrl})`} with a Pages type, ${seeded.entries} entries and a main menu.`,
      );
      break;
    case "exists":
      environment.out(
        `Warning: ${created.domain} already exists in CMS Ace (as "${seeded.name}"), so it was left alone: nothing was added to it.`,
      );
      break;
    case "failed":
      environment.error(
        `The site ${created.domain} was made in CMS Ace but setting it up stopped: ${seeded.message}\n` +
          "It is half set up: finish it in the admin app, or delete it there and run this again.",
      );
      break;
  }
  const shown = relative(environment.workingDirectory, created.folder) || ".";
  environment.out(`Made ${created.name} (${created.framework}) in ${shown}.

Next:
  1. cd ${shown}
  2. npm install
  3. npm run dev`);
  return seeded.kind === "failed" ? 1 : 0;
}
