import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { createAceClient } from "../client/create-client";
import { generateTypes } from "../helpers/generate-types";
import { packageName } from "../helpers/package-name";
import { domainFromSite, hostedApiUrl } from "../helpers/platform";
import type { CliEnvironment } from "./environment";

export const generateUsage = `ace-kit generate: write TypeScript types for your CMS Ace content types.

Usage:
  ace-kit generate [--site <domain>] [--api-url <address>] [--out <file>]

Options:
  --site      The domain your site has in the CMS, e.g. example.com (or set ACE_SITE_DOMAIN). --domain means the same.
  --api-url   Where the CMS Ace API lives (or set ACE_API_URL). Only for a CMS on your own machine.
  --out       Where to write the types (default: src/ace-kit.generated.d.ts).
  --help      Show this message.
`;

export async function generateCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const { values } = parseArgs({
    // eslint-disable-next-line id-denylist -- "args" is the name node's parseArgs gives this option.
    args: commandArguments,
    options: {
      "api-url": { type: "string" },
      site: { type: "string" },
      domain: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    environment.out(generateUsage);
    return 0;
  }

  const apiUrl = values["api-url"] ?? environment.variables.ACE_API_URL ?? hostedApiUrl;
  const given = values.site ?? values.domain ?? environment.variables.ACE_SITE_DOMAIN;
  if (!given) {
    environment.error("Give the site's domain: --site, or ACE_SITE_DOMAIN.");
    return 1;
  }
  const siteDomain = domainFromSite(given);

  const client = createAceClient({
    apiUrl,
    siteDomain,
    cacheSeconds: 0,
    fetchImplementation: environment.fetchImplementation,
  });
  const contentTypes = await client.getContentTypes();
  const file = resolve(values.out ?? "src/ace-kit.generated.d.ts");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, generateTypes(contentTypes, packageName, siteDomain));
  environment.out(
    `Wrote types for ${contentTypes.length} content type${contentTypes.length === 1 ? "" : "s"} to ${file}.`,
  );
  return 0;
}
