import type { AcePage } from "../types/page";

type MetaDescriptor = { title: string } | { name: string; content: string };

/**
 * The route's `meta`: the entry's title (followed by the site's name, if you give one), its description, and
 * `noindex` for a preview so search engines ignore it.
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
    if (page.headers["Cache-Control"]) descriptors.push({ name: "robots", content: "noindex" });
    return descriptors;
  };
}

/** `createMeta()` without a site name. */
export const meta = createMeta();
