import { cp, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { packageName } from "../helpers/package-name";
import { domainFromSite } from "../helpers/platform";

export const frameworks = ["astro", "react-router"] as const;
export type Framework = (typeof frameworks)[number];

export type CreateSiteOptions = {
  /** Where the new site goes. It is made if it does not exist, and must be empty if it does. */
  folder: string;
  framework: Framework;
  /** The site's domain in CMS Ace, or a web address with it in. */
  site: string;
  /** The site's name as shown to visitors; made from the folder's name when left out. */
  name?: string;
  /** The folder holding the starter sites (templates/ in this package). */
  templatesDirectory: string;
  /** Settings for the site's .env file: what a site needs to find a CMS that isn't the hosted one. */
  environmentSettings?: Record<string, string>;
  /** The version of Ace Kit the site depends on. "development" (run from source) means the latest release. */
  kitVersion: string;
};

export type CreatedSite = {
  folder: string;
  framework: Framework;
  name: string;
  packageName: string;
  domain: string;
};

/** A site's name ends up inside source files, so it is kept to characters that can't change what a file means. */
const validName = /^[\p{L}\p{N}][\p{L}\p{N} .,-]{0,59}$/u;
const validDomain = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "my-site" becomes "My Site". */
export function nameFromFolder(folder: string): string {
  return basename(resolve(folder))
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** An npm package name from a folder's name: lower case, with anything npm would not accept turned into a hyphen. */
export function packageNameFromFolder(folder: string): string {
  return basename(resolve(folder))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[-]+$/g, "");
}

/** Reads a site's domain from what a person typed, and says what is wrong with it if it can't be one. */
export function checkDomain(site: string): string {
  const domain = domainFromSite(site);
  if (!validDomain.test(domain))
    throw new Error(`"${site}" is not a domain: give the site's domain, for example example.com.`);
  return domain;
}

async function isEmptyOrMissing(folder: string): Promise<boolean> {
  try {
    return (await readdir(folder)).length === 0;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return true;
    throw error;
  }
}

async function listFiles(folder: string, base = folder): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else files.push(path.slice(base.length + 1));
  }
  return files;
}

/** Writes `text` only when the starter has no file there already, so a starter file always wins. */
async function writeNew(folder: string, file: string, text: string): Promise<void> {
  await mkdir(dirname(join(folder, file)), { recursive: true });
  await writeFile(join(folder, file), text, { flag: "wx" });
}

/** Changes one thing in one file and fails if it was not there: a starter that has drifted should not half work. */
function replaceOnce(file: string, text: string, pattern: RegExp, replacement: string): string {
  if (!pattern.test(text)) throw new Error(`the starter's ${file} has changed: could not find ${pattern}.`);
  return text.replace(pattern, () => replacement);
}

export type SitePlan = { folder: string; domain: string; name: string; packageName: string };

/** Checks everything about a new site that can be checked without making anything, and says what is wrong if not. */
export async function planSite(options: Pick<CreateSiteOptions, "folder" | "site" | "name">): Promise<SitePlan> {
  const folder = resolve(options.folder);
  const domain = checkDomain(options.site);
  const name = options.name ?? nameFromFolder(folder);
  const siteName = packageNameFromFolder(folder);
  if (!validName.test(name))
    throw new Error(
      `"${name}" can't be the site's name: use letters, numbers, spaces, full stops, commas and hyphens, up to 60.`,
    );
  if (!siteName)
    throw new Error(`Can't make a package name from "${basename(folder)}": give the folder a name with letters in it.`);
  if (!(await isEmptyOrMissing(folder)))
    throw new Error(`${folder} is not empty. Choose a folder that doesn't exist yet.`);
  return { folder, domain, name, packageName: siteName };
}

/** Makes a new site from one of the starter sites: a copy with the name, domain and package made yours. */
export async function createSite(options: CreateSiteOptions): Promise<CreatedSite> {
  const { folder, domain, name, packageName: siteName } = await planSite(options);

  const template = join(options.templatesDirectory, options.framework);
  await mkdir(folder, { recursive: true });
  await cp(template, folder, { recursive: true });

  // npm never publishes a file called .gitignore, so the starter keeps it as _gitignore.
  await rename(join(folder, "_gitignore"), join(folder, ".gitignore"));

  // The kit's own version: a site made by 0.6.0 starts on ^0.6.0.
  const kitSpec = options.kitVersion === "development" ? "latest" : `^${options.kitVersion}`;
  const manifestPath = join(folder, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    name: string;
    dependencies: Record<string, string>;
  };
  manifest.name = siteName;
  if (!(packageName in manifest.dependencies))
    throw new Error(`the starter's package.json does not depend on ${packageName}.`);
  manifest.dependencies[packageName] = kitSpec;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // Words that belong to the example site: its name, and the line saying it is a test.
  const wording: [string, string][] = [
    ["Example Site. A test site for CMS Ace.", `${name}.`],
    ["A simple example site for testing CMS Ace.", `${name}, built on CMS Ace.`],
    ["Example Site", name],
  ];
  for (const file of await listFiles(folder)) {
    if (file === "package.json" || file.endsWith(".ico")) continue;
    const path = join(folder, file);
    const original = await readFile(path, "utf8");
    if (original.includes("\0")) continue;
    let text = original;
    for (const [from, to] of wording) text = text.replaceAll(from, () => to);
    if (file === "astro.config.mjs")
      text = replaceOnce(file, text, /site: "https?:\/\/[^"]+"/, `site: "https://${domain}"`);
    if (text !== original) await writeFile(path, text);
  }

  // The hosted CMS Ace is where a site connects unless told otherwise, so a new site's .env.example doesn't mention it.
  // (Only a site made against a CMS on the developer's own machine gets a .env, written below.)
  const extraSettings = Object.entries(options.environmentSettings ?? {}).map(([name, value]) => `${name}=${value}`);
  if (options.framework === "astro") {
    await writeNew(
      folder,
      ".env.example",
      [
        "# The site's domain in CMS Ace is the `site` setting in astro.config.mjs. Set this only to override it.",
        "# ACE_SITE_DOMAIN=" + domain,
        "",
      ].join("\n"),
    );
    if (extraSettings.length > 0) await writeNew(folder, ".env", `${extraSettings.join("\n")}\n`);
  } else {
    // A React Router site names itself here, and the dev server reads .env.
    const domainLine = `ACE_SITE_DOMAIN=${domain}\n`;
    await writeNew(folder, ".env.example", [`# The site's domain in CMS Ace.`, domainLine].join("\n"));
    await writeNew(folder, ".env", [domainLine.trim(), ...extraSettings].join("\n") + "\n");
  }

  await writeNew(folder, "README.md", readme({ name, domain, framework: options.framework }));
  return { folder, framework: options.framework, name, packageName: siteName, domain };
}

function readme(site: { name: string; domain: string; framework: Framework }): string {
  const frameworkName = site.framework === "astro" ? "Astro" : "React Router";
  return `# ${site.name}

A ${frameworkName} site on [CMS Ace](https://github.com/sandboxSonny/ace-kit#readme), made with \`npx ${packageName} create\`. Its domain in the CMS is \`${site.domain}\`.

## Start

\`npm install\`, then \`npm run dev\`. The dev server works on your own private copy of the site in CMS Ace, so nothing you try touches the live one. (\`npx ace-kit login\` signs you in again if you need to.)

## Commands

- \`npm run dev\` runs the site, syncing the section types in your code to the CMS.
- \`npm run generate\` writes TypeScript types for your content types (run it after changing them).
- \`npm run check\` runs Prettier, ESLint, the type check, the tests and a build.

## Sections

Each kind of page section is a component with a \`*.schema.ts\` file beside it saying what an editor can fill in. See [Sections](https://github.com/sandboxSonny/ace-kit/blob/main/docs/sections.md) in the Ace Kit docs.
`;
}
