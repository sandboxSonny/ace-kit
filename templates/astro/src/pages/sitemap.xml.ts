import type { APIRoute } from "astro";
import { getSitemapResponse } from "@sandboxsonny/ace-kit/astro";

// The live pages from the CMS, for search engines. Content types whose entries aren't pages are left out there.
export const GET: APIRoute = ({ url }) => getSitemapResponse({ url });
