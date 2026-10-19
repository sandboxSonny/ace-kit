import { describe, expect, it } from "vitest";

import { createMeta } from "./meta";
import type { AcePage } from "../types/page";

const entryPage = (values: Record<string, unknown>, headers: Record<string, string> = {}) =>
  ({
    kind: "entry",
    status: 200,
    entry: { id: 1, content_type_handle: "pages", handle: "about", title: "About", description: "", values },
    headers,
  }) as unknown as AcePage;

const robotsOf = (page: AcePage) =>
  createMeta()({ data: page }).find((descriptor) => "name" in descriptor && descriptor.name === "robots");

describe("createMeta", () => {
  it("adds no robots tag for an ordinary entry", () => {
    expect(robotsOf(entryPage({}))).toBeUndefined();
  });

  it("follows the entry's noindex and nofollow checkboxes", () => {
    expect(robotsOf(entryPage({ "seo-noindex": true }))).toEqual({ name: "robots", content: "noindex" });
    expect(robotsOf(entryPage({ "seo-nofollow": true }))).toEqual({ name: "robots", content: "nofollow" });
    expect(robotsOf(entryPage({ "seo-noindex": true, "seo-nofollow": true }))).toEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });

  it("marks a preview noindex", () => {
    expect(robotsOf(entryPage({}, { "Cache-Control": "no-store" }))).toEqual({ name: "robots", content: "noindex" });
  });
});
