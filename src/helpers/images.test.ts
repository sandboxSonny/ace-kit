import { describe, expect, it } from "vitest";

import { imageAttributes } from "./images";
import type { AceImageData } from "../types/images";

const image: AceImageData = {
  id: 1,
  url: "https://cdn.test/a.png",
  src: "https://cdn.test/cdn-cgi/image/width=1280/a.png",
  srcset: "https://cdn.test/s-640.png 640w, https://cdn.test/s-1280.png 1280w",
  width: 1280,
  height: 720,
  alt_text: "A beach",
  content_type: "image/png",
};

describe("imageAttributes", () => {
  it("uses src, srcset, sizes, the dimensions and the alt text, lazily by default", () => {
    expect(imageAttributes(image, { sizes: "100vw" })).toEqual({
      src: image.src,
      srcSet: image.srcset,
      sizes: "100vw",
      width: 1280,
      height: 720,
      alt: "A beach",
      loading: "lazy",
      decoding: "async",
      fetchPriority: undefined,
    });
  });

  it("loads the image at the top of the page eagerly and with priority", () => {
    const attributes = imageAttributes(image, { sizes: "100vw", lazy: false });
    expect([attributes.loading, attributes.fetchPriority]).toEqual(["eager", "high"]);
  });

  it("leaves out srcset and sizes when there are no copies, and the size when it isn't known", () => {
    const attributes = imageAttributes({ ...image, srcset: "", width: null, height: null }, { sizes: "100vw" });
    expect([attributes.srcSet, attributes.sizes, attributes.width, attributes.height]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("keeps the size to whole positive numbers, because it ends up in markup", () => {
    const sized = (width: unknown, height: unknown) =>
      imageAttributes({ ...image, width, height } as unknown as AceImageData, { sizes: "100vw" });
    expect([sized(640.6, 480).width, sized(640.6, 480).height]).toEqual([641, 480]);
    for (const bad of ['640" onerror="alert(1)', Number.NaN, Number.POSITIVE_INFINITY, -5, 0, null, {}]) {
      expect([sized(bad, bad).width, sized(bad, bad).height], String(bad)).toEqual([undefined, undefined]);
    }
  });
});
