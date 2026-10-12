import { ACE_PREVIEW_ADMIN_ORIGIN } from "astro:env/server";

import { addFramingPolicy } from "../helpers/preview";

/**
 * Lets the CMS's admin app, and only it, show this site inside a frame, so the editor can preview drafts. The
 * integration registers it; a site never imports it.
 */
export async function onRequest(_context: unknown, next: () => Promise<Response>): Promise<Response> {
  const response = await next();
  addFramingPolicy(response.headers, ACE_PREVIEW_ADMIN_ORIGIN);
  return response;
}
