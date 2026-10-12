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
