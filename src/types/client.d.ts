export type AceClientOptions = {
  /** Where the CMS Ace API lives, e.g. `https://api.example.com`. */
  apiUrl: string;
  /** The domain this site has in the CMS. */
  siteDomain: string;
  /** How long an answer is reused, in seconds, so busy pages don't hit the API's per-IP rate limit. 0 turns caching off. */
  cacheSeconds?: number;
  fetchImplementation?: typeof fetch;
  now?: () => number;
};
