import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { frameworks, type Framework } from "./create-site";
import { frameworksWithSections, starterEntries } from "./starter-content";

describe("starterEntries", () => {
  it.each(frameworks)("gives every %s entry the SEO title and description the CMS requires", (framework) => {
    for (const entry of starterEntries(framework, "Acme")) {
      expect(entry.values["seo-title"], entry.handle).toEqual(expect.any(String));
      expect(entry.values["seo-title"], entry.handle).not.toBe("");
      expect(entry.values["seo-description"], entry.handle).toEqual(expect.any(String));
      expect(entry.values["seo-description"], entry.handle).not.toBe("");
    }
  });
});

type SectionValue = { type: string };
type SectionTypesFile = { sections: { handle: string }[] };

const templatesFolder = join(dirname(fileURLToPath(import.meta.url)), "../../templates");

function sectionsUsedBy(framework: Framework): string[] {
  return starterEntries(framework, "Acme").flatMap((entry) =>
    ((entry.values.content as SectionValue[] | undefined) ?? []).map((section) => section.type),
  );
}

describe("the sections the starter entries use", () => {
  it.each(frameworksWithSections)("all exist in the %s starter's section types", (framework) => {
    const file = JSON.parse(
      readFileSync(join(templatesFolder, `${framework}.section-types.json`), "utf8"),
    ) as SectionTypesFile;
    const known = file.sections.map((section) => section.handle);
    for (const type of sectionsUsedBy(framework)) expect(known, type).toContain(type);
  });

  it("puts a contact form on the Astro starter's Contact page", () => {
    const contact = starterEntries("astro", "Acme").find((entry) => entry.handle === "contact");
    const sections = contact?.values.content as { type: string; values: Record<string, unknown> }[];
    expect(sections.map((section) => section.type)).toEqual(["contact-form"]);
    expect(sections[0].values.button).toBe("Send message");
  });

  it("leaves the contact form off a starter that has no component for it", () => {
    expect(sectionsUsedBy("react-router")).not.toContain("contact-form");
  });
});
