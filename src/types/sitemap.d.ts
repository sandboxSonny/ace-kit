/** One page of the site as the CMS lists it for the sitemap. */
export type AceSitemapEntry = {
  /** The address visitors use: "/" for the home entry, otherwise "/{content type}/{entry}". */
  path: string;
  /** When the entry was last changed, as an ISO date and time. */
  updated_at: string;
};
