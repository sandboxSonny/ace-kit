import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defineSection } from "../sections/define-section";
import { fakeEnvironment, json } from "./fake-environment";
import type { Routes } from "./fake-environment";
import { runCli } from "./main";

const api = "http://localhost:8080";
const hero = defineSection({ handle: "hero", name: "Hero", fields: [{ handle: "heading", label: "H", type: "text" }] });
const faq = defineSection({ handle: "faq", name: "FAQ", fields: [{ handle: "heading", label: "H", type: "text" }] });

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ace-kit-doctor-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function makeSite(options: { kit?: boolean; astroSite?: string; dependencies?: Record<string, string> } = {}) {
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "shop",
      dependencies: options.dependencies ?? { astro: "^7", "@sandboxsonny/ace-kit": "^0.6.0" },
    }),
  );
  if (options.kit !== false) {
    await mkdir(join(root, "node_modules/@sandboxsonny/ace-kit"), { recursive: true });
    await writeFile(
      join(root, "node_modules/@sandboxsonny/ace-kit/package.json"),
      JSON.stringify({ version: "0.6.0" }),
    );
  }
  await writeFile(
    join(root, "astro.config.mjs"),
    `export default { site: "${options.astroSite ?? "https://shop.example.com"}" };\n`,
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/Hero.schema.ts"), "");
  await writeFile(join(root, "src/Faq.schema.ts"), "");
}

const cms = (overrides: Routes = {}): Routes => ({
  [`GET ${api}/health`]: () => json({ status: "ok" }),
  [`GET ${api}/public/site`]: () => json({ id: 1, name: "Shop", domain: "shop.example.com", handle: "shop" }),
  [`GET ${api}/public/content-types`]: () => json([{ handle: "pages" }]),
  [`GET ${api}/public/entries?content_type=pages&limit=100`]: () => json([{ handle: "home" }, { handle: "about" }]),
  [`GET ${api}/auth/me`]: () => json({ email: "sam@example.com" }),
  [`GET ${api}/sites`]: () =>
    json([{ id: 1, name: "Shop", domain: "shop.example.com", kind: "real", preview_url: "http://localhost:4321" }]),
  [`GET ${api}/sites/1/section-types`]: () => json([{ handle: "hero" }, { handle: "faq" }]),
  ...overrides,
});

function setup(routes: Routes = cms(), options: { signedIn?: boolean; nodeVersion?: string } = {}) {
  const created = fakeEnvironment(routes, {
    variables: { ACE_API_URL: api },
    workingDirectory: root,
    nodeVersion: options.nodeVersion ?? "24.14.0",
    importModule: async (path) => ({ default: path.endsWith("Hero.schema.ts") ? hero : faq }),
  });
  if (options.signedIn !== false)
    created.store.items[api] = {
      token: "secret-token-value",
      email: "sam@example.com",
      expiresAt: "2027-01-01T00:00:00Z",
    };
  return created;
}

const report = (created: { output: string[] }) => created.output.join("\n");

describe("ace-kit doctor", () => {
  it("says all good for a healthy site, and exits 0", async () => {
    await makeSite();
    const created = setup();
    expect(await runCli(["doctor"], created.environment)).toBe(0);
    const text = report(created);
    expect(text).toContain("✓ Node 24.14.0");
    expect(text).toContain("✓ An Astro site");
    expect(text).toContain("✓ Ace Kit 0.6.0 is installed");
    expect(text).toContain("✓ Site: shop.example.com");
    expect(text).toContain('✓ The CMS knows the site: "Shop"');
    expect(text).toContain("including home");
    expect(text).toContain("✓ Signed in as sam@example.com");
    expect(text).toContain("✓ Preview address: http://localhost:4321");
    expect(text).toContain("2 section types in your code (faq, hero)");
    expect(text).toContain("All good.");
  });

  it("never prints the login", async () => {
    await makeSite();
    const created = setup();
    await runCli(["doctor"], created.environment);
    expect(report(created) + created.errors.join("")).not.toContain("secret-token-value");
  });

  it("says to run it in a site's folder when there is no package.json", async () => {
    const created = setup();
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain("✗ No package.json in this folder");
  });

  it("says to install when Ace Kit isn't installed", async () => {
    await makeSite({ kit: false });
    const created = setup();
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain("✗ Ace Kit isn't installed");
    expect(report(created)).toContain("Run: npm install");
  });

  it("fails on a Node that is too old", async () => {
    await makeSite();
    const created = setup(cms(), { nodeVersion: "16.20.2" });
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain("✗ Node 16.20.2 is too old");
  });

  it("fails when the CMS can't be reached, and doesn't go on to ask it more", async () => {
    await makeSite();
    const created = setup({});
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain(`✗ Can't reach the CMS at ${api}`);
    expect(report(created)).toContain("docker compose");
  });

  it("fails when the CMS has no site with the domain", async () => {
    await makeSite({ astroSite: "https://nope.example.com" });
    const created = setup(cms({ [`GET ${api}/public/site`]: () => json({ error: "site not found" }, 404) }));
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain("✗ The CMS has no site with the domain nope.example.com");
    expect(report(created)).toContain("create");
  });

  it("fails when it can't tell which site this is", async () => {
    await makeSite({ dependencies: { "react-router": "^7", "@sandboxsonny/ace-kit": "^0.6.0" } });
    const created = setup();
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain("✓ A React Router site");
    expect(report(created)).toContain("✗ Can't tell which site this is");
    expect(report(created)).toContain("ACE_SITE_DOMAIN");
  });

  it("warns, without failing, when you aren't signed in", async () => {
    await makeSite();
    const created = setup(cms(), { signedIn: false });
    expect(await runCli(["doctor"], created.environment)).toBe(0);
    expect(report(created)).toContain("! Not signed in");
    expect(report(created)).toContain(`npx ace-kit login --api-url ${api}`);
    expect(report(created)).toContain("Nothing is broken; 1 warning.");
  });

  it("warns when the login has ended", async () => {
    await makeSite();
    const created = setup(cms({ [`GET ${api}/auth/me`]: () => json({ error: "unauthorized" }, 401) }));
    expect(await runCli(["doctor"], created.environment)).toBe(0);
    expect(report(created)).toContain("! Your login has ended");
  });

  it("warns when there is no Pages type, or no home entry", async () => {
    await makeSite();
    const noType = setup(cms({ [`GET ${api}/public/content-types`]: () => json([]) }));
    await runCli(["doctor"], noType.environment);
    expect(report(noType)).toContain("! The site has no Pages content type");

    const noHome = setup(
      cms({ [`GET ${api}/public/entries?content_type=pages&limit=100`]: () => json([{ handle: "about" }]) }),
    );
    await runCli(["doctor"], noHome.environment);
    expect(report(noHome)).toContain("! Pages has no published entry called home");
  });

  it("warns about section types that are in the code but not in the CMS, and notes the unused ones", async () => {
    await makeSite();
    const created = setup(
      cms({
        [`GET ${api}/sites/1/section-types`]: () =>
          json([{ handle: "hero" }, { handle: "old" }, { handle: "gone", retired_at: "2026-01-01" }]),
      }),
    );
    expect(await runCli(["doctor"], created.environment)).toBe(0);
    expect(report(created)).toContain("! Not in the CMS yet: faq");
    expect(report(created)).toContain("Run: npx ace-kit sync");
    expect(report(created)).toContain("- In the CMS but not in your code: old");
    expect(report(created)).not.toContain("gone");
  });

  it("fails when a schema file can't be used", async () => {
    await makeSite();
    const created = setup();
    created.environment.importModule = async () => {
      throw new Error("Unexpected token");
    };
    expect(await runCli(["doctor"], created.environment)).toBe(1);
    expect(report(created)).toContain("✗ Section schema problem");
  });

  it("shows words from the CMS as plain text", async () => {
    await makeSite();
    const created = setup(cms({ [`GET ${api}/public/site`]: () => json({ name: "Shop\u001b[2J" }) }));
    await runCli(["doctor"], created.environment);
    expect(report(created)).not.toContain("\u001b");
  });

  it("shows its help", async () => {
    const created = setup();
    expect(await runCli(["doctor", "--help"], created.environment)).toBe(0);
    expect(report(created)).toContain("ace-kit doctor");
  });
});
