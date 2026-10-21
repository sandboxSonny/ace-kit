import type { APIRoute } from "astro";
import { getRobotsResponse } from "@sandboxsonny/ace-kit/astro";

// Lets crawlers in and points them at the sitemap.
export const GET: APIRoute = ({ url }) => getRobotsResponse({ url });
