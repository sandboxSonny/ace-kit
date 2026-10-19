import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findFormFiles, findSchemaFiles, formFilePattern, schemaFilePattern } from "./find-schemas";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ace-kit-schemas-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function touch(...path: string[]) {
  const file = join(root, ...path);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, "");
}

const names = (files: string[]) => files.map((file) => relative(root, file).split("\\").join("/"));

describe("findSchemaFiles", () => {
  it("finds schema files at any depth, in a steady order", async () => {
    await touch("src", "components", "sections", "Hero.schema.ts");
    await touch("src", "Faq.schema.ts");
    await touch("src", "a", "b", "Gallery.schema.mjs");
    await touch("src", "legacy.schema.js");
    expect(names(await findSchemaFiles(root))).toEqual([
      "src/Faq.schema.ts",
      "src/a/b/Gallery.schema.mjs",
      "src/components/sections/Hero.schema.ts",
      "src/legacy.schema.js",
    ]);
  });

  it("ignores everything that isn't a schema file, including type declarations", async () => {
    await touch("src", "Hero.ts");
    await touch("src", "Hero.astro");
    await touch("src", "schema.ts");
    await touch("src", "Hero.schema.d.ts");
    await touch("src", "Hero.schema.tsx");
    await touch("src", "Hero.schema.ts.bak");
    expect(await findSchemaFiles(root)).toEqual([]);
  });

  it("does not look inside folders that never hold a site's own files", async () => {
    for (const folder of ["node_modules", ".git", "dist", ".astro", ".react-router", "build"])
      await touch("src", folder, "Hidden.schema.ts");
    await touch("src", "Real.schema.ts");
    expect(names(await findSchemaFiles(root))).toEqual(["src/Real.schema.ts"]);
  });

  it("looks in src and app unless a folder is asked for, and nowhere else", async () => {
    await touch("src", "InSrc.schema.ts");
    await touch("app", "InApp.schema.ts");
    await touch("lib", "Elsewhere.schema.ts");
    await touch("Root.schema.ts");
    expect(names(await findSchemaFiles(root))).toEqual(["app/InApp.schema.ts", "src/InSrc.schema.ts"]);
    expect(names(await findSchemaFiles(root, "app"))).toEqual(["app/InApp.schema.ts"]);
    expect(names(await findSchemaFiles(root, "lib"))).toEqual(["lib/Elsewhere.schema.ts"]);
  });

  it("finds nothing, without failing, when the folder isn't there", async () => {
    expect(await findSchemaFiles(root)).toEqual([]);
    expect(await findSchemaFiles(root, "nope/at/all")).toEqual([]);
  });
});

describe("schemaFilePattern", () => {
  it("matches the file names a schema may have", () => {
    for (const name of [
      "Faq.schema.ts",
      "faq.schema.mts",
      "faq.schema.js",
      "faq.schema.mjs",
      "Image-Gallery.schema.ts",
    ])
      expect(schemaFilePattern.test(name), name).toBe(true);
    for (const name of ["faq.ts", "faq.schema", "schema.ts", "faq.schema.json", "faq.schemas.ts"])
      expect(schemaFilePattern.test(name), name).toBe(false);
  });
});

describe("findFormFiles", () => {
  it("finds form files, and not schema files, in src and app", async () => {
    await touch("src", "contact.form.ts");
    await touch("app", "forms", "quote.form.mjs");
    await touch("src", "Hero.schema.ts");
    await touch("src", "contact.form.d.ts");
    await touch("src", "form.ts");
    expect(names(await findFormFiles(root))).toEqual(["app/forms/quote.form.mjs", "src/contact.form.ts"]);
    expect(names(await findSchemaFiles(root))).toEqual(["src/Hero.schema.ts"]);
  });

  it("matches the file names a person would write", () => {
    expect(formFilePattern.test("contact.form.ts")).toBe(true);
    expect(formFilePattern.test("contact.form.js")).toBe(true);
    expect(formFilePattern.test("contact.forms.ts")).toBe(false);
    expect(schemaFilePattern.test("contact.form.ts")).toBe(false);
  });
});
