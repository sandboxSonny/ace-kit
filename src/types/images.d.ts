/** An image as the CMS Ace public API returns it. Use `src` and `srcset` in an `<img>`. */
export type AceImageData = {
  id: number;
  /** The untouched original. */
  url: string;
  /** A web-sized copy, for browsers that ignore `srcset`. */
  src: string;
  /** Copies at several widths; empty when the image is too small to need them. */
  srcset: string;
  width: number | null;
  height: number | null;
  alt_text: string;
  content_type: string;
};
