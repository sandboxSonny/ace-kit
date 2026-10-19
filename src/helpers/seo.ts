import type { AceEntry } from "../types/entries";
import type { AceFavicon } from "../types/site";

/** The two values every entry has, whatever its content type: what a search engine shows for it. */
export const seoTitleHandle = "seo-title";
export const seoDescriptionHandle = "seo-description";
/** Two optional checkboxes on every entry: ask search engines to leave the page out, and not to follow its links. */
export const seoNoindexHandle = "seo-noindex";
export const seoNofollowHandle = "seo-nofollow";

export type AceSeoOptions = {
  /** The entry the page shows. Its SEO title and description are used, falling back to its title and description. */
  entry?: Pick<AceEntry, "title" | "description" | "values">;
  /** Used when there is no entry, or the entry has no title of its own. */
  title?: string;
  /** Used when there is no entry, or the entry has no description of its own. */
  description?: string;
  /** The site's name: it ends the page's `<title>` ("About us | Acme") and is the shared link's `og:site_name`. */
  siteName?: string;
  /** The page's address, if it isn't the one requested. Left out, the requested address is used. */
  canonical?: string;
  /**
   * A picture to show when the page is shared: a full web address. In the Astro `<AceSeo>`, leaving it out uses the
   * social image chosen in the site's settings in the CMS (if any).
   */
  image?: string;
  /**
   * The site's favicon. In the Astro `<AceSeo>`, leaving it out uses the favicon chosen in the site's settings in the
   * CMS (if any); it then adds `<link rel="icon">` and `<link rel="apple-touch-icon">`.
   */
  favicon?: Pick<AceFavicon, "icon" | "apple_touch_icon">;
  /**
   * Tells search engines to leave the page out, as for a draft shown in preview. The entry's own "noindex" checkbox
   * does the same, so this only ever adds to it.
   */
  noindex?: boolean;
  /** Tells search engines not to follow the page's links. The entry's own "nofollow" checkbox does the same. */
  nofollow?: boolean;
};

type Meta = { property?: string; name?: string; content: string };
type Link = { rel: string; href: string; sizes?: string };

/** What `astro-seo`'s `<SEO>` takes (only the parts used here). */
export type AceSeoProperties = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex: boolean;
  nofollow: boolean;
  twitter: { card: "summary" | "summary_large_image"; title?: string; description?: string; image?: string };
  extend: { meta: Meta[]; link?: Link[] };
};

const textValue = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** What an entry's "noindex" and "nofollow" checkboxes say (unticked, or never saved, is false). */
export function robotsFlags(entry: { values?: Record<string, unknown> } | undefined): {
  noindex: boolean;
  nofollow: boolean;
} {
  return { noindex: entry?.values?.[seoNoindexHandle] === true, nofollow: entry?.values?.[seoNofollowHandle] === true };
}

/** The `robots` directives for a page ("noindex, nofollow"), or "" when search engines may do both. */
export function robotsDirectives({ noindex, nofollow }: { noindex: boolean; nofollow: boolean }): string {
  return [noindex && "noindex", nofollow && "nofollow"].filter(Boolean).join(", ");
}

/**
 * Works out what a page's search and sharing tags say. An entry's SEO title and description win, and its "noindex" and "nofollow" checkboxes turn on the robots tags; if the editor left
 * them out (an entry saved before they were required, say) its own title and description are used, then the
 * options'. The site's name ends the `<title>` (not the sharing titles), unless the title already is the name.
 * Open Graph is written as plain meta tags, so a page with no picture needs no placeholder.
 */
export function seoProperties(options: AceSeoOptions): AceSeoProperties {
  const { entry } = options;
  const flags = robotsFlags(entry);
  const title = textValue(entry?.values?.[seoTitleHandle]) || textValue(entry?.title) || textValue(options.title);
  const description =
    textValue(entry?.values?.[seoDescriptionHandle]) || textValue(entry?.description) || textValue(options.description);

  const meta: Meta[] = [{ property: "og:type", content: "website" }];
  if (title) meta.push({ property: "og:title", content: title });
  if (description) meta.push({ property: "og:description", content: description });
  if (options.siteName) meta.push({ property: "og:site_name", content: options.siteName });
  if (options.canonical) meta.push({ property: "og:url", content: options.canonical });
  if (options.image) meta.push({ property: "og:image", content: options.image });

  const siteName = options.siteName?.trim();
  const pageTitle = title && siteName && title !== siteName ? `${title} | ${siteName}` : title;

  return {
    ...(pageTitle && { title: pageTitle }),
    ...(description && { description }),
    ...(options.canonical && { canonical: options.canonical }),
    noindex: options.noindex === true || flags.noindex,
    nofollow: options.nofollow === true || flags.nofollow,
    twitter: {
      card: options.image ? "summary_large_image" : "summary",
      ...(title && { title }),
      ...(description && { description }),
      ...(options.image && { image: options.image }),
    },
    extend: {
      meta,
      ...(options.favicon && {
        link: [
          { rel: "icon", href: options.favicon.icon, sizes: "48x48" },
          { rel: "apple-touch-icon", href: options.favicon.apple_touch_icon },
        ],
      }),
    },
  };
}
