import type { AceImageData } from "./images";

/** The site the request is for, as the CMS Ace public API returns it. */
export type AceSite = {
  id: number;
  name: string;
  domain: string;
  handle: string;
  /** The picture the site's owners chose to show in search results and social posts; null if none. */
  social_image: AceImageData | null;
};
