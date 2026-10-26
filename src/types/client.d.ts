/** Where a site's code is running: as its production website, or on a developer's machine. */
export type AceEnvironment = "production" | "development";

export type AceClientOptions = {
  /** Where the CMS Ace API lives, e.g. `https://api.example.com`. */
  apiUrl: string;
  /** The domain this site has in the CMS. */
  siteDomain: string;
  /** How long an answer is reused, in seconds, so busy pages don't hit the API's per-IP rate limit. 0 turns caching off. */
  cacheSeconds?: number;
  /**
   * Whether this is the site's production website or a developer's machine, sent to the CMS so a site that hasn't
   * launched yet launches itself on its production website's first read. Default: worked out from the process
   * (`ACE_ENVIRONMENT`, then a dev server or test run means development, anything else production).
   */
  environment?: AceEnvironment;
  fetchImplementation?: typeof fetch;
  now?: () => number;
};
