import { describe, expect, it } from "vitest";

import { defineSection } from "./define-section";
import { loadSchemas } from "./load-schemas";

const root = "/site";
const hero = defineSection({
  handle: "hero",
  name: "Hero",
  fields: [{ handle: "heading", label: "Heading", type: "text" }],
});
const faq = defineSection({ handle: "faq", name: "FAQ" });

const loaderFor = (modules: Record<string, unknown>) => async (path: string) => {
  if (!(path in modules)) throw new Error(`Cannot find ${path}`);
  const module = modules[path];
  if (module instanceof Error) throw module;
  return module;
};

describe("loadSchemas", () => {
  it("returns the definitions of files that export a good one, in the order given", async () => {
    const loaded = await loadSchemas(
      ["/site/src/Faq.schema.ts", "/site/src/Hero.schema.ts"],
      root,
      loaderFor({ "/site/src/Faq.schema.ts": { default: faq }, "/site/src/Hero.schema.ts": { default: hero } }),
    );
    expect(loaded.problems).toEqual([]);
    expect(loaded.definitions.map((entry) => entry.definition.handle)).toEqual(["faq", "hero"]);
    expect(loaded.definitions[0].file).toBe("/site/src/Faq.schema.ts");
  });

  it("reports a file with no default export, or the wrong one, by its name", async () => {
    const loaded = await loadSchemas(
      ["/site/src/A.schema.ts", "/site/src/B.schema.ts"],
      root,
      loaderFor({ "/site/src/A.schema.ts": {}, "/site/src/B.schema.ts": { default: "hero" } }),
    );
    expect(loaded.definitions).toEqual([]);
    expect(loaded.problems).toEqual([
      expect.stringMatching(/^src[\\/]A\.schema\.ts: the default export must be the result of defineSection/),
      expect.stringMatching(/^src[\\/]B\.schema\.ts: the default export must be the result of defineSection/),
    ]);
  });

  it("reports a file that can't be loaded, with the reason", async () => {
    const loaded = await loadSchemas(
      ["/site/src/Broken.schema.ts"],
      root,
      loaderFor({ "/site/src/Broken.schema.ts": new SyntaxError("Unexpected token '}'") }),
    );
    expect(loaded.problems).toEqual([
      expect.stringMatching(/^src[\\/]Broken\.schema\.ts: could not be loaded: Unexpected token '}'$/),
    ]);
  });

  it("keeps going after a bad file, so every problem is reported at once", async () => {
    const loaded = await loadSchemas(
      ["/site/src/Bad.schema.ts", "/site/src/Hero.schema.ts", "/site/src/Missing.schema.ts"],
      root,
      loaderFor({
        "/site/src/Bad.schema.ts": { default: { handle: "Bad Handle", name: "" } },
        "/site/src/Hero.schema.ts": { default: hero },
      }),
    );
    expect(loaded.definitions.map((entry) => entry.definition.handle)).toEqual(["hero"]);
    expect(loaded.problems.length).toBeGreaterThanOrEqual(3);
    expect(loaded.problems.some((problem) => problem.includes("Missing.schema.ts"))).toBe(true);
  });

  it("refuses two files that define the same handle, naming the first", async () => {
    const loaded = await loadSchemas(
      ["/site/src/One.schema.ts", "/site/src/Two.schema.ts"],
      root,
      loaderFor({ "/site/src/One.schema.ts": { default: hero }, "/site/src/Two.schema.ts": { default: { ...hero } } }),
    );
    expect(loaded.definitions).toHaveLength(1);
    expect(loaded.problems).toEqual([
      expect.stringMatching(/Two\.schema\.ts: the handle "hero" is already used by src[\\/]One\.schema\.ts\./),
    ]);
  });

  it("loads nothing from no files", async () => {
    expect(await loadSchemas([], root, loaderFor({}))).toEqual({ definitions: [], problems: [] });
  });
});
