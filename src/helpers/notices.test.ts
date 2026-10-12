import { describe, expect, it } from "vitest";

import { pageNotices } from "./notices";

describe("pageNotices", () => {
  it("says something for every page that isn't an entry", () => {
    for (const kind of ["not-found", "unavailable", "preview-expired", "redirect"] as const) {
      expect(pageNotices[kind].heading, kind).not.toBe("");
      expect(pageNotices[kind].message, kind).not.toBe("");
    }
  });
});
