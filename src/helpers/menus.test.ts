import { describe, expect, it } from "vitest";

import { isCurrentPage, linksFromMenu } from "./menus";
import type { AceMenu } from "../types/menus";

describe("isCurrentPage", () => {
  const home = { label: "Home", to: "/" };
  const about = { label: "About", to: "/pages/about" };

  it("matches a link to its own page, with or without a trailing slash", () => {
    expect(isCurrentPage(about, "/pages/about")).toBe(true);
    expect(isCurrentPage(about, "/pages/about/")).toBe(true);
  });

  it("matches the home link only on the home page", () => {
    expect(isCurrentPage(home, "/")).toBe(true);
    expect(isCurrentPage(home, "/pages/about")).toBe(false);
  });

  it("does not match a different page", () => {
    expect(isCurrentPage(about, "/contact")).toBe(false);
  });
});

describe("linksFromMenu", () => {
  const entry = { id: 1, title: "t", handle: "h", content_type_handle: "pages" };
  const menu: AceMenu = {
    name: "Main menu",
    handle: "main-menu",
    items: [
      { label: "Home", url: "/pages/home", kind: "entry", entry, children: [] },
      {
        label: "About",
        url: "/pages/about",
        kind: "entry",
        entry,
        children: [{ label: "Shop", url: "https://shop.example.com", kind: "url", entry: null, children: [] }],
      },
    ],
  };

  it("turns each link into a navigation link, keeping the order and the nesting", () => {
    expect(linksFromMenu(menu)).toEqual([
      { label: "Home", to: "/" },
      { label: "About", to: "/pages/about", children: [{ label: "Shop", to: "https://shop.example.com" }] },
    ]);
  });

  it("gives the home entry the address it redirects to, so the link is not a redirect and shows as current", () => {
    const [home] = linksFromMenu(menu);
    expect(home.to).toBe("/");
    expect(isCurrentPage(home, "/")).toBe(true);
  });

  it("copes with an empty menu", () => {
    expect(linksFromMenu({ name: "Empty", handle: "empty", items: [] })).toEqual([]);
  });
});
