import { describe, expect, it } from "vitest";

import { addressFromPath, homeAddress, isHomeAddress, pathOfAddress, visitablePath } from "./addressing";

describe("addressFromPath", () => {
  it("treats the root as the home entry", () => {
    for (const root of [undefined, "", "/"]) expect(addressFromPath(root)).toEqual(homeAddress);
  });

  it("reads /{content type}/{entry}", () => {
    expect(addressFromPath("pages/about")).toEqual({ contentTypeHandle: "pages", entryHandle: "about" });
    expect(addressFromPath("/blog-posts/my-first-post/")).toEqual({
      contentTypeHandle: "blog-posts",
      entryHandle: "my-first-post",
    });
  });

  it("is not a page when it has one part or more than two", () => {
    expect(addressFromPath("about")).toBeNull();
    expect(addressFromPath("blog/2026/post")).toBeNull();
  });

  it("is not a page when a part couldn't be a handle", () => {
    for (const bad of ["Pages/about", "pages/About", "pages/a b", "../secret", "pages/..", "pages/-x", "pages/x_y"]) {
      expect(addressFromPath(bad), bad).toBeNull();
    }
  });
});

describe("home entry", () => {
  it("knows its own address, and the path it redirects away from", () => {
    expect(isHomeAddress(homeAddress)).toBe(true);
    expect(isHomeAddress({ contentTypeHandle: "pages", entryHandle: "about" })).toBe(false);
    expect(pathOfAddress(homeAddress)).toBe("/pages/home");
    expect(visitablePath("/pages/home")).toBe("/");
    expect(visitablePath("/pages/about")).toBe("/pages/about");
  });
});
