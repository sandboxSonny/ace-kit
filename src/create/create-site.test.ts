import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkDomain, createSite, nameFromFolder, packageNameFromFolder } from "./create-site";
import type { Framework } from "./create-site";

const templatesDirectory = fileURLToPath(new URL("../../templates", import.meta.url));

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ace-kit-create-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const make = (framework: Framework, overrides: Partial<Parameters<typeof createSite>[0]> = {}) =>
  createSite({
    folder: join(root, "my-shop"),
    framework,
    site: "shop.example.com",
    templatesDirectory,
    kitVersion: "0.6.0",
    ...overrides,
  });

async function allFiles(folder: string, base = folder): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await allFiles(path, base)));
    else files.push(path.slice(base.length + 1));
  }
  return files;
}

describe("the starters", () => {
  it("contain no symbolic links: they would copy as links to this machine, and npm does not publish them", async () => {
    const links: string[] = [];
    const walk = async (folder: string) => {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isSymbolicLink()) links.push(path);
        else if (entry.isDirectory()) await walk(path);
      }
    };
    await walk(templatesDirectory);
    expect(links).toEqual([]);
  });
});

describe("names", () => {
  it("makes a readable name and a package name from the folder", () => {
    expect(nameFromFolder("/x/my-shop")).toBe("My Shop");
    expect(nameFromFolder("/x/bakery_site.2")).toBe("Bakery Site 2");
    expect(packageNameFromFolder("/x/My Shop!")).toBe("my-shop");
  });

  it("reads a domain from a web address and rejects what is not one", () => {
    expect(checkDomain("https://Shop.Example.com/about")).toBe("shop.example.com");
    expect(() => checkDomain("localhost")).toThrow(/not a domain/);
    expect(() => checkDomain("not a domain")).toThrow(/not a domain/);
    expect(() => checkDomain("")).toThrow(/not a domain/);
  });
});

describe.each<Framework>(["astro", "react-router"])("createSite (%s)", (framework) => {
  it("copies the starter and makes it the site's own", async () => {
    const site = await make(framework);
    expect(site).toMatchObject({ name: "My Shop", packageName: "my-shop", domain: "shop.example.com" });

    const files = await allFiles(site.folder);
    expect(files).toContain(".gitignore");
    expect(files).not.toContain("_gitignore");
    expect(files).toContain("README.md");
    expect(files).toContain(".env.example");

    const manifest = JSON.parse(await readFile(join(site.folder, "package.json"), "utf8"));
    expect(manifest.name).toBe("my-shop");
    expect(manifest.dependencies["@sandboxsonny/ace-kit"]).toBe("^0.6.0");

    // Nothing of the example is left in any text file.
    for (const file of files.filter((name) => !name.endsWith(".ico"))) {
      const text = await readFile(join(site.folder, file), "utf8");
      expect(text, file).not.toContain("Example Site");
      expect(text, file).not.toContain("adamsdevelopment.co.uk");
      expect(text, file).not.toContain("file:../ace-kit");
    }
  });

  it("puts the site's name where visitors see it", async () => {
    const site = await make(framework, { name: "Bobs Bakery" });
    const header = await readFile(
      join(site.folder, framework === "astro" ? "src/components/SiteHeader.astro" : "app/components/site-header.tsx"),
      "utf8",
    );
    expect(header).toContain("Bobs Bakery");
  });

  it("refuses a folder that already has things in it, and leaves them alone", async () => {
    const folder = join(root, "taken");
    await mkdir(folder);
    await writeFile(join(folder, "mine.txt"), "keep");
    await expect(make(framework, { folder })).rejects.toThrow(/is not empty/);
    expect(await readdir(folder)).toEqual(["mine.txt"]);
  });

  it("accepts an empty folder that exists already", async () => {
    const folder = join(root, "empty");
    await mkdir(folder);
    await expect(make(framework, { folder })).resolves.toMatchObject({ packageName: "empty" });
  });

  it("refuses a name that could change what a source file means", async () => {
    for (const name of ['A"B', "A<b>", "A{b}", "A`b", "A$b", "A\\b", "A'b", "A&b", ""]) {
      await expect(make(framework, { name })).rejects.toThrow(/can't be the site's name/);
    }
  });

  it("depends on the latest Ace Kit when run from source", async () => {
    const site = await make(framework, { kitVersion: "development" });
    const manifest = JSON.parse(await readFile(join(site.folder, "package.json"), "utf8"));
    expect(manifest.dependencies["@sandboxsonny/ace-kit"]).toBe("latest");
  });
});

describe("createSite settings", () => {
  it("names an Astro site in its config, not in .env", async () => {
    const site = await make("astro");
    expect(await readFile(join(site.folder, "astro.config.mjs"), "utf8")).toContain('site: "https://shop.example.com"');
    expect((await allFiles(site.folder)).includes(".env")).toBe(false);
  });

  it("names a React Router site in .env, which the dev server reads", async () => {
    const site = await make("react-router");
    expect(await readFile(join(site.folder, ".env"), "utf8")).toBe("ACE_SITE_DOMAIN=shop.example.com\n");
    expect(await readFile(join(site.folder, ".env.example"), "utf8")).toContain("ACE_SITE_DOMAIN=shop.example.com");
  });

  it("fails loudly when the starter no longer has the line it changes", async () => {
    const copy = join(root, "templates");
    await mkdir(join(copy, "astro"), { recursive: true });
    await writeFile(join(copy, "astro", "_gitignore"), "");
    await writeFile(
      join(copy, "astro", "package.json"),
      JSON.stringify({ name: "x", dependencies: { "@sandboxsonny/ace-kit": "1" } }),
    );
    await writeFile(join(copy, "astro", "astro.config.mjs"), "export default {};\n");
    await expect(make("astro", { templatesDirectory: copy })).rejects.toThrow(/astro\.config\.mjs has changed/);
  });
});
