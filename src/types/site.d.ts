import type { AceImageData } from "./images";

/** The site's favicon as the CMS Ace public API returns it: the original, and square PNG copies. */
export type AceFavicon = {
  id: number;
  /** The untouched original. */
  url: string;
  /** A small square PNG (48 pixels), for the browser tab and search results. */
  icon: string;
  /** A square PNG (180 pixels), for a phone's home screen. */
  apple_touch_icon: string;
  content_type: string;
};

/** The site the request is for, as the CMS Ace public API returns it. */
export type AceSite = {
  id: number;
  name: string;
  domain: string;
  handle: string;
  /** The picture the site's owners chose to show in search results and social posts; null if none. */
  social_image: AceImageData | null;
  /** The small picture the site's owners chose for browser tabs; null if none. */
  favicon: AceFavicon | null;
};
