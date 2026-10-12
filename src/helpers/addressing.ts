import type { AceAddress } from "../types/addressing";

/** The content type and entry shown at "/". */
export const homeAddress: AceAddress = { contentTypeHandle: "pages", entryHandle: "home" };

/** The path of an entry: `/{content type}/{entry}`. */
export const pathOfAddress = (address: AceAddress) => `/${address.contentTypeHandle}/${address.entryHandle}`;

const handlePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Reads an address the way Shopify does: "/{content type}/{entry}", so "/pages/about" is the entry "about" of the
 * content type "pages". "/" is the home entry. Anything else is not a page.
 */
export function addressFromPath(slug: string | undefined): AceAddress | null {
  const segments = (slug ?? "").split("/").filter((segment) => segment !== "");
  if (segments.length === 0) return homeAddress;
  if (segments.length !== 2 || !segments.every((segment) => handlePattern.test(segment))) return null;
  return { contentTypeHandle: segments[0], entryHandle: segments[1] };
}

/** Whether an address is the home entry's own address, which redirects to "/". */
export const isHomeAddress = (address: AceAddress) =>
  address.contentTypeHandle === homeAddress.contentTypeHandle && address.entryHandle === homeAddress.entryHandle;

/**
 * Where a path from the CMS should really go: the home entry's own address, which redirects, is replaced by
 * the "/" it redirects to.
 */
export function visitablePath(path: string): string {
  return path === pathOfAddress(homeAddress) ? "/" : path;
}
