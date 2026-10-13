import type { AceLinkData } from "../types/links";
import { visitablePath } from "./addressing";

/**
 * Where a link in rich text goes, or null if it can't be trusted. The CMS only allows paths, web addresses,
 * mailto: and tel:; this checks again so the page stays safe even if something else ever gets into the text.
 */
export function linkAddress(address: string): string | null {
  const allowed = /^(\/(?!\/)|https?:\/\/[^\s/]|mailto:\S|tel:\S)/.test(address) && !/\s/.test(address);
  return allowed ? visitablePath(address) : null;
}

/** Whether a link stays on this site: a path such as "/pages/about", not "//elsewhere", "https://..." or "mailto:...". */
export function isInternalPath(address: string): boolean {
  return address.startsWith("/") && !address.startsWith("//");
}

/** What to draw for a link field: where it goes and its words (null when the editor gave none). */
export type AceLinkAttributes = {
  href: string;
  label: string | null;
};

/**
 * What a link field's value is drawn with, or null if its address can't be trusted. The CMS only allows paths, web
 * addresses, mailto: and tel:; this checks again so the page stays safe even if something else ever gets into the data.
 */
export function linkAttributes(link: AceLinkData): AceLinkAttributes | null {
  const href = linkAddress(link.href);
  return href ? { href, label: link.label ? link.label : null } : null;
}
