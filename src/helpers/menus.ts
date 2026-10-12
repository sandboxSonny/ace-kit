import { AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";
import type { AceMenu, AceMenuItem, AceNavigationLink } from "../types/menus";
import { visitablePath } from "./addressing";

/** A CMS menu as links ready to draw. An entry link to the home entry goes to "/" so it isn't a redirect. */
export function linksFromMenu(menu: AceMenu): AceNavigationLink[] {
  const convert = (items: AceMenuItem[]): AceNavigationLink[] =>
    items.map((item) => {
      const children = convert(item.children);
      const to = visitablePath(item.url);
      return children.length > 0 ? { label: item.label, to, children } : { label: item.label, to };
    });
  return convert(menu.items);
}

/** Whether a link is for the page being shown. "/" matches only the home page; a trailing slash is ignored. */
export function isCurrentPage(link: AceNavigationLink, pathname: string): boolean {
  const normalised = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return link.to === normalised;
}

/**
 * A menu's links, ready to draw. If the site has no such menu, or the CMS can't be reached, `fallback` is returned
 * instead (a missing menu must never take a whole page down); anything else that goes wrong is a bug and is thrown.
 */
export async function loadMenuLinks(
  client: AceClient,
  handle: string,
  fallback: AceNavigationLink[] = [],
): Promise<AceNavigationLink[]> {
  try {
    const menu = await client.getMenu(handle);
    return menu ? linksFromMenu(menu) : fallback;
  } catch (error) {
    if (!(error instanceof AceUnavailableError)) throw error;
    console.error(error.message);
    return fallback;
  }
}
