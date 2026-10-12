import type { AceImageData } from "../types/images";

export type AceImageOptions = {
  /** How wide the image is shown, e.g. "(min-width: 64rem) 64rem, 100vw". The browser uses it to pick a copy from srcset. */
  sizes: string;
  /** Leave on for images below the first screen; turn off for the one at the top of the page. */
  lazy?: boolean;
};

/** The attributes of an `<img>` for an image: the same for every framework. */
export type AceImageAttributes = {
  src: string;
  srcSet: string | undefined;
  sizes: string | undefined;
  width: number | undefined;
  height: number | undefined;
  alt: string;
  loading: "lazy" | "eager";
  decoding: "async";
  fetchPriority: "high" | undefined;
};

/** A width or height as a whole, positive number, or nothing: it ends up inside markup, so it must be a number. */
function dimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 ? Math.round(value) : undefined;
}

/** What to put on an `<img>`: a web-sized `src`, `srcset` when there are copies, and the size so the page doesn't jump. */
export function imageAttributes(image: AceImageData, { sizes, lazy = true }: AceImageOptions): AceImageAttributes {
  return {
    src: image.src,
    srcSet: image.srcset || undefined,
    sizes: image.srcset ? sizes : undefined,
    width: dimension(image.width),
    height: dimension(image.height),
    alt: image.alt_text,
    loading: lazy ? "lazy" : "eager",
    decoding: "async",
    fetchPriority: lazy ? undefined : "high",
  };
}
