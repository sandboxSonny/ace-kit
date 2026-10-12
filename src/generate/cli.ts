import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { createAceClient } from "../client/create-client";
import { generateTypes } from "../helpers/generate-types";
import { packageName } from "../helpers/package-name";

const usage = `ace-kit generate: write TypeScript types for your CMS Ace content types.

Usage:
  ace-kit generate [--api-url <address>] [--domain <domain>] [--out <file>]

Options:
  --api-url   Where the CMS Ace API lives (or set ACE_API_URL, in the environment or a .env file).
  --domain    The domain your site has in the CMS (or set ACE_SITE_DOMAIN).
  --out       Where to write the types (default: src/ace-kit.generated.d.ts).
  --help      Show this message.
`;

async function main(): Promise<number> {
  // Settings may be in a .env file in the folder the command runs in (variables already set win).
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the environment and the options are enough.
  }

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "api-url": { type: "string" },
      domain: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });

  if (values.help || positionals[0] !== "generate") {
    console.log(usage);
    return values.help ? 0 : 1;
  }

  const apiUrl = values["api-url"] ?? process.env.ACE_API_URL;
  const siteDomain = values.domain ?? process.env.ACE_SITE_DOMAIN;
  if (!apiUrl || !siteDomain) {
    console.error(
      "Give the API address and the site's domain: --api-url and --domain, or ACE_API_URL and ACE_SITE_DOMAIN.",
    );
    return 1;
  }

  const client = createAceClient({ apiUrl, siteDomain, cacheSeconds: 0 });
  const contentTypes = await client.getContentTypes();
  const file = resolve(values.out ?? "src/ace-kit.generated.d.ts");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, generateTypes(contentTypes, packageName, siteDomain));
  console.log(`Wrote types for ${contentTypes.length} content type${contentTypes.length === 1 ? "" : "s"} to ${file}.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
