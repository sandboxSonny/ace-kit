import { describe, expect, it } from "vitest";

import { robotsDirectives, robotsFlags, seoProperties } from "./seo";

const entry = {
  title: "About",
  description: "The entry's own description",
  values: { "seo-title": "About us | Acme", "seo-description": "Who we are." },
};

describe("seoProperties", () => {
  it("uses the entry's SEO title and description", () => {
    const properties = seoProperties({ entry });
    expect(properties.title).toBe("About us | Acme");
    expect(properties.description).toBe("Who we are.");
    expect(properties.extend.meta).toContainEqual({ property: "og:title", content: "About us | Acme" });
    expect(properties.extend.meta).toContainEqual({ property: "og:description", content: "Who we are." });
    expect(properties.twitter).toEqual({ card: "summary", title: "About us | Acme", description: "Who we are." });
  });

  it("falls back to the entry's title and description, then to the options", () => {
    expect(seoProperties({ entry: { ...entry, values: {} } })).toMatchObject({
      title: "About",
      description: "The entry's own description",
    });
    expect(seoProperties({ entry: { ...entry, values: { "seo-title": "  ", "seo-description": 5 } } })).toMatchObject({
      title: "About",
      description: "The entry's own description",
    });
    expect(
      seoProperties({
        entry: { title: "", description: "", values: {} },
        title: "Site",
        description: "A site.",
      }),
    ).toMatchObject({ title: "Site", description: "A site." });
    expect(seoProperties({ title: "Site" })).toMatchObject({ title: "Site" });
  });

  it("leaves out what it has nothing for", () => {
    const properties = seoProperties({});
    expect(properties).not.toHaveProperty("title");
    expect(properties).not.toHaveProperty("description");
    expect(properties).not.toHaveProperty("canonical");
    expect(properties.extend.meta).toEqual([{ property: "og:type", content: "website" }]);
  });

  it("ends the title with the site's name, but not the sharing titles, and not when the title is the name", () => {
    const properties = seoProperties({ entry: { ...entry, values: { "seo-title": "About us" } }, siteName: " Acme " });
    expect(properties.title).toBe("About us | Acme");
    expect(properties.extend.meta).toContainEqual({ property: "og:title", content: "About us" });
    expect(properties.twitter.title).toBe("About us");
    expect(seoProperties({ title: "Acme", siteName: "Acme" }).title).toBe("Acme");
    expect(seoProperties({ siteName: "Acme" })).not.toHaveProperty("title");
  });

  it("adds the site name, address and picture when given", () => {
    const properties = seoProperties({
      entry,
      siteName: "Acme",
      canonical: "https://acme.test/pages/about",
      image: "https://acme.test/share.jpg",
    });
    expect(properties.canonical).toBe("https://acme.test/pages/about");
    expect(properties.extend.meta).toEqual(
      expect.arrayContaining([
        { property: "og:site_name", content: "Acme" },
        { property: "og:url", content: "https://acme.test/pages/about" },
        { property: "og:image", content: "https://acme.test/share.jpg" },
      ]),
    );
    expect(properties.twitter.card).toBe("summary_large_image");
    expect(properties.twitter.image).toBe("https://acme.test/share.jpg");
  });

  it("marks a page noindex only when told to", () => {
    expect(seoProperties({ entry }).noindex).toBe(false);
    expect(seoProperties({ entry, noindex: true }).noindex).toBe(true);
    expect(seoProperties({ entry }).nofollow).toBe(false);
    expect(seoProperties({ entry, nofollow: true }).nofollow).toBe(true);
  });

  it("follows the entry's noindex and nofollow checkboxes", () => {
    const withValues = (values: Record<string, unknown>) => ({ entry: { ...entry, values } });
    expect(seoProperties(withValues({ "seo-noindex": true }))).toMatchObject({ noindex: true, nofollow: false });
    expect(seoProperties(withValues({ "seo-nofollow": true }))).toMatchObject({ noindex: false, nofollow: true });
    expect(seoProperties(withValues({ "seo-noindex": false, "seo-nofollow": "true" }))).toMatchObject({
      noindex: false,
      nofollow: false,
    });
    // The option adds to the checkbox; it never turns it off.
    expect(seoProperties({ ...withValues({ "seo-noindex": true }), noindex: false }).noindex).toBe(true);
  });

  it("words the robots directives", () => {
    expect(robotsDirectives({ noindex: false, nofollow: false })).toBe("");
    expect(robotsDirectives({ noindex: true, nofollow: false })).toBe("noindex");
    expect(robotsDirectives({ noindex: false, nofollow: true })).toBe("nofollow");
    expect(robotsDirectives({ noindex: true, nofollow: true })).toBe("noindex, nofollow");
    expect(robotsFlags(undefined)).toEqual({ noindex: false, nofollow: false });
  });

  it("links the site's favicon, and only when there is one", () => {
    const favicon = { icon: "https://cdn.test/48.png", apple_touch_icon: "https://cdn.test/180.png" };
    expect(seoProperties({ title: "Site", favicon }).extend.link).toEqual([
      { rel: "icon", href: "https://cdn.test/48.png", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "https://cdn.test/180.png" },
    ]);
    expect(seoProperties({ title: "Site" }).extend).not.toHaveProperty("link");
  });
});
