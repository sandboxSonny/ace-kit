import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { normaliseApiUrl } from "../auth/login-store";
import { resolveLogin } from "../auth/resolve-login";
import { domainFromSite, hostedApiUrl } from "../helpers/platform";
import { findSchemaFiles } from "../sections/find-schemas";
import { loadSchemas } from "../sections/load-schemas";
import { isLocalApiUrl } from "./api-url";
import type { CliEnvironment } from "./environment";

export const doctorUsage = `ace-kit doctor: check that this site is set up to work with CMS Ace.

Usage:
  ace-kit doctor [--site <domain>] [--api-url <address>] [--dir <folder>]

Run it in your site's folder. It changes nothing and never prints your login. It checks your Node version, that Ace Kit
is installed, which CMS and site the settings point at, that the CMS can be reached and knows the site, that you are
signed in, that the site has its Pages content, and that the section types in your code match the CMS. Each problem
says what to do. It exits with 1 if anything is wrong.

Options:
  --site      The domain your site has in the CMS (default: ACE_SITE_DOMAIN, else Astro's \`site\` setting).
  --api-url   Where the CMS Ace API lives (default: ACE_API_URL, else the hosted CMS Ace).
  --dir       The folder holding your *.schema.ts files (default: src).
  --help      Show this message.
`;

type Status = "ok" | "warn" | "fail" | "info";
type Check = { status: Status; label: string; hint?: string };

const symbols: Record<Status, string> = { ok: "✓", warn: "!", fail: "✗", info: "-" };
const requestTimeoutMilliseconds = 15_000;

/** Words from the CMS are shown as text only: control characters (terminal escape codes) are dropped. */
const plain = (text: unknown) =>
  String(text)
    .replace(/\p{Cc}/gu, "")
    .slice(0, 200);

const isOlderThan = (version: string, major: number, minor: number) => {
  const [actualMajor = 0, actualMinor = 0] = version.split(".").map(Number);
  return actualMajor < major || (actualMajor === major && actualMinor < minor);
};

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** The domain in Astro's own `site` setting, if the site has an astro.config file that sets one. */
async function domainFromAstroConfig(root: string): Promise<string | null> {
  for (const name of ["astro.config.mjs", "astro.config.ts", "astro.config.js", "astro.config.mts"]) {
    const text = await readText(join(root, name));
    const found = text?.match(/\bsite\s*:\s*["']([^"']+)["']/);
    if (found?.[1]) return domainFromSite(found[1]);
  }
  return null;
}

export async function doctorCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const { values } = parseArgs({
    // eslint-disable-next-line id-denylist -- "args" is the name node's parseArgs gives this option.
    args: commandArguments,
    options: {
      "api-url": { type: "string" },
      site: { type: "string" },
      dir: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    environment.out(doctorUsage);
    return 0;
  }

  const checks: Check[] = [];
  const add = (status: Status, label: string, hint?: string) => checks.push({ status, label, hint });
  const root = environment.workingDirectory;

  // Node.
  if (isOlderThan(environment.nodeVersion, 22, 12))
    add(
      "fail",
      `Node ${environment.nodeVersion} is too old`,
      "Ace Kit needs Node 22.12 or newer. If you use mise, nvm or fnm, check which version it picks in this folder.",
    );
  else add("ok", `Node ${environment.nodeVersion}`);

  // The project.
  const manifestText = await readText(join(root, "package.json"));
  let framework: "astro" | "react-router" | null = null;
  if (manifestText === null) {
    add("fail", "No package.json in this folder", "Run this in your site's folder.");
  } else {
    let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      add("fail", "package.json isn't valid JSON");
    }
    const dependencies = { ...manifest.devDependencies, ...manifest.dependencies };
    if ("astro" in dependencies) framework = "astro";
    else if ("react-router" in dependencies) framework = "react-router";
    add(
      framework ? "ok" : "info",
      framework
        ? framework === "astro"
          ? "An Astro site"
          : "A React Router site"
        : "Not an Astro or React Router site",
    );

    const installed = await readText(join(root, "node_modules", "@sandboxsonny", "ace-kit", "package.json"));
    if (!("@sandboxsonny/ace-kit" in dependencies)) {
      add("fail", "Ace Kit isn't a dependency of this site", "Run: npm install @sandboxsonny/ace-kit");
    } else if (installed === null) {
      add("fail", "Ace Kit isn't installed", "Run: npm install");
    } else {
      let version = "unknown";
      try {
        version = String((JSON.parse(installed) as { version?: unknown }).version ?? "unknown");
      } catch {
        // Unreadable: the version stays unknown.
      }
      add("ok", `Ace Kit ${version} is installed`);
      if (version !== environment.version && environment.version !== "development")
        add("info", `This command is Ace Kit ${environment.version}; the site uses ${version}`);
    }
  }

  // Which CMS and which site.
  let apiUrl: string | null = null;
  try {
    apiUrl = normaliseApiUrl(values["api-url"] ?? environment.variables.ACE_API_URL ?? hostedApiUrl);
    add("ok", `CMS: ${apiUrl}${apiUrl === hostedApiUrl ? " (the hosted CMS Ace)" : ""}`);
  } catch (error) {
    add("fail", `The CMS address is wrong: ${error instanceof Error ? error.message : String(error)}`);
  }

  const given = values.site ?? environment.variables.ACE_SITE_DOMAIN;
  const domain = given ? domainFromSite(given) : framework === "astro" ? await domainFromAstroConfig(root) : null;
  if (domain) add("ok", `Site: ${domain}`);
  else
    add(
      "fail",
      "Can't tell which site this is",
      framework === "astro"
        ? 'Set `site: "https://your-domain.com"` in astro.config.mjs, or ACE_SITE_DOMAIN in .env.'
        : "Set ACE_SITE_DOMAIN=your-domain.com in .env.",
    );

  if (apiUrl) await checkTheCms(apiUrl, domain);
  return finish();

  async function request(
    path: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: unknown } | null> {
    try {
      const response = await environment.fetchImplementation(`${apiUrl}${path}`, {
        headers: { Accept: "application/json", ...headers },
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    } catch {
      return null;
    }
  }

  async function checkTheCms(address: string, siteDomain: string | null) {
    const health = await request("/health");
    if (!health || health.status >= 500 || health.status === 404) {
      add(
        "fail",
        `Can't reach the CMS at ${address}`,
        isLocalApiUrl(address)
          ? "Is your local CMS running? (docker compose -p cms-backend up -d)"
          : "Check the address and your connection.",
      );
      return;
    }
    add("ok", "The CMS answers");
    if (!siteDomain) return;

    const asSite = { "X-Ace-Site-Domain": siteDomain };
    const site = await request("/public/site", asSite);
    if (site?.status === 404) {
      add(
        "fail",
        `The CMS has no site with the domain ${siteDomain}`,
        "Make it with `npx @sandboxsonny/ace-kit create`, or in the admin app, or fix the domain.",
      );
    } else if (site?.status === 200) {
      add("ok", `The CMS knows the site: "${plain((site.body as { name?: unknown })?.name)}"`);
      await checkContent(asSite);
    } else {
      add("fail", `The CMS answered with an error (${site?.status ?? "no answer"}) when asked about the site`);
    }

    await checkLogin(address, siteDomain);
  }

  async function checkContent(asSite: Record<string, string>) {
    const types = await request("/public/content-types", asSite);
    const typeList = Array.isArray(types?.body) ? (types.body as { handle?: string }[]) : [];
    if (!typeList.some((type) => type.handle === "pages")) {
      add(
        "warn",
        "The site has no Pages content type",
        "The starter's pages read one. Add it in the admin app (Content types).",
      );
      return;
    }
    const entries = await request("/public/entries?content_type=pages&limit=100", asSite);
    const list = Array.isArray(entries?.body) ? (entries.body as { handle?: string }[]) : [];
    if (list.some((entry) => entry.handle === "home"))
      add("ok", `Pages has ${list.length} published ${list.length === 1 ? "entry" : "entries"}, including home`);
    else
      add(
        "warn",
        "Pages has no published entry called home",
        "The site's front page (/) reads it. Add one in the admin app and publish it.",
      );
  }

  async function checkLogin(address: string, siteDomain: string) {
    const login = await resolveLogin({
      apiUrl: address,
      variables: environment.variables,
      store: environment.store,
      now: environment.now,
    });
    if (!login) {
      add(
        "warn",
        "Not signed in",
        `Run: npx ace-kit login${isLocalApiUrl(address) ? ` --api-url ${address}` : ""}. Section sync and dev sites need it.`,
      );
      return;
    }
    const authorised = { Authorization: `Bearer ${login.token}` };
    const me = await request("/auth/me", authorised);
    if (me?.status === 401) {
      add("warn", "Your login has ended", "Run: npx ace-kit login");
      return;
    }
    if (me?.status !== 200) {
      add("warn", `Couldn't check your login (${me?.status ?? "no answer"})`);
      return;
    }
    add("ok", `Signed in as ${plain((me.body as { email?: unknown })?.email)}`);

    const sites = await request("/sites", authorised);
    const visible = Array.isArray(sites?.body)
      ? (sites.body as { id: number; domain: string; kind?: string; preview_url?: string }[])
      : [];
    const mine = visible.find((candidate) => candidate.kind !== "dev" && candidate.domain.toLowerCase() === siteDomain);
    if (!mine) {
      add("info", "This login can't see that site, so its section types and preview address weren't checked");
      return;
    }
    if (mine.preview_url) add("ok", `Preview address: ${plain(mine.preview_url)}`);
    else if (isLocalApiUrl(address))
      add(
        "warn",
        "The site has no Preview address",
        "Set it in the site's Settings (for example http://localhost:4321) so the customiser can show your site.",
      );

    await checkSections(address, mine.id, authorised);
  }

  async function checkSections(address: string, siteId: number, authorised: Record<string, string>) {
    const files = await findSchemaFiles(root, values.dir ?? "src");
    if (files.length === 0) {
      add("info", "No section schemas (*.schema.ts) in your code");
      return;
    }
    const loaded = await loadSchemas(files, root, environment.importModule);
    if (loaded.problems.length > 0) {
      for (const problem of loaded.problems) add("fail", `Section schema problem: ${plain(problem)}`);
      return;
    }
    const inCode = loaded.definitions.map(({ definition }) => definition.handle);
    add("ok", `${inCode.length} section type${inCode.length === 1 ? "" : "s"} in your code (${inCode.join(", ")})`);

    const cms = await request(`/sites/${siteId}/section-types`, authorised);
    if (!Array.isArray(cms?.body)) return;
    const active = new Set(
      (cms.body as { handle: string; retired_at?: string }[])
        .filter((type) => !type.retired_at)
        .map((type) => type.handle),
    );
    const missing = inCode.filter((handle) => !active.has(handle));
    const unused = [...active].filter((handle) => !inCode.includes(handle));
    if (missing.length > 0)
      add(
        "warn",
        `Not in the CMS yet: ${missing.join(", ")}`,
        `Run: npx ace-kit sync${isLocalApiUrl(address) ? ` --api-url ${address}` : ""} (the dev server does this on save)`,
      );
    else add("ok", "The CMS has all of them");
    if (unused.length > 0)
      add(
        "info",
        `In the CMS but not in your code: ${unused.join(", ")} (a sync would retire ${unused.length === 1 ? "it" : "them"})`,
      );
  }

  function finish(): number {
    environment.out("ace-kit doctor\n");
    for (const check of checks) {
      environment.out(`  ${symbols[check.status]} ${check.label}`);
      if (check.hint) environment.out(`      ${check.hint}`);
    }
    const failed = checks.filter((check) => check.status === "fail").length;
    const warned = checks.filter((check) => check.status === "warn").length;
    environment.out(
      failed > 0
        ? `\n${failed} problem${failed === 1 ? "" : "s"} to fix${warned > 0 ? `, and ${warned} warning${warned === 1 ? "" : "s"}` : ""}.`
        : warned > 0
          ? `\nNothing is broken; ${warned} warning${warned === 1 ? "" : "s"}.`
          : "\nAll good.",
    );
    return failed > 0 ? 1 : 0;
  }
}
