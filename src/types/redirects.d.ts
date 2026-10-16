/** A redirect the CMS has for an address, as its public API returns it. */
export type AceRedirect = {
  /** The old address the redirect is for. */
  from: string;
  /** Where it goes: a path on the site, or a full web address. */
  to: string;
  /** 301 is permanent; 302 is temporary. */
  status: 301 | 302;
};
