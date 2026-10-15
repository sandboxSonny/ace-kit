import { describe, expect, it } from "vitest";

import { frameworks } from "./create-site";
import { starterEntries } from "./starter-content";

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
