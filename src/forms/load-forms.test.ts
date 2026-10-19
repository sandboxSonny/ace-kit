import { describe, expect, it } from "vitest";

import { loadForms } from "./load-forms";

const contact = { handle: "contact", name: "Contact", fields: [{ handle: "name", label: "Name", type: "text" }] };

describe("loadForms", () => {
  it("loads each file's default export", async () => {
    const loaded = await loadForms(["/site/src/contact.form.ts"], "/site", async () => ({ default: contact }));
    expect(loaded.problems).toEqual([]);
    expect(loaded.definitions).toEqual([{ file: "/site/src/contact.form.ts", definition: contact }]);
  });

  it("collects every problem: a file that won't load, a bad form and a handle used twice", async () => {
    const modules: Record<string, unknown> = {
      "/site/src/a.form.ts": new Error("boom"),
      "/site/src/b.form.ts": { default: { handle: "x", name: "", fields: [] } },
      "/site/src/c.form.ts": { default: contact },
      "/site/src/d.form.ts": { default: contact },
    };
    const loaded = await loadForms(Object.keys(modules), "/site", async (path) => {
      if (modules[path] instanceof Error) throw modules[path];
      return modules[path];
    });
    expect(loaded.definitions).toHaveLength(1);
    const text = loaded.problems.join("\n");
    expect(text).toContain("src/a.form.ts: could not be loaded: boom");
    expect(text).toContain("src/b.form.ts: needs a name.");
    expect(text).toContain('src/d.form.ts: the handle "contact" is already used by src/c.form.ts.');
  });
});
