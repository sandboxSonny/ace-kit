import { robotsDirectives, robotsFlags } from "../helpers/seo";
import type { AcePage } from "../types/page";

type MetaDescriptor = { title: string } | { name: string; content: string };

/**
 * The route's `meta`: the entry's title (followed by the site's name, if you give one), its description, and
 * `noindex` for a preview so search engines ignore it, and the robots directives the entry's "noindex" and
 * "nofollow" checkboxes ask for.
 *
 *     export const meta = createMeta({ siteName: "Example Site" });
 */
export function createMeta({ siteName }: { siteName?: string } = {}) {
  const suffix = siteName ? ` | ${siteName}` : "";
  return function meta({ data }: { data: unknown }): MetaDescriptor[] {
    const page = data as AcePage | undefined;
    if (!page) return siteName ? [{ title: siteName }] : [];
    const descriptors: MetaDescriptor[] = [];
    if (page.kind === "entry") {
      descriptors.push({ title: `${page.entry.title}${suffix}` });
      if (page.entry.description) descriptors.push({ name: "description", content: page.entry.description });
    } else if (siteName) {
      descriptors.push({ title: siteName });
    }
    const flags = page.kind === "entry" ? robotsFlags(page.entry) : { noindex: false, nofollow: false };
    const directives = robotsDirectives({ ...flags, noindex: flags.noindex || Boolean(page.headers["Cache-Control"]) });
    if (directives) descriptors.push({ name: "robots", content: directives });
    return descriptors;
  };
}

/** `createMeta()` without a site name. */
export const meta = createMeta();
