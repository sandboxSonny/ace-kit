import type { APIRoute } from "astro";
import { getFormSubmitResponse } from "@sandboxsonny/ace-kit/astro";

export const prerender = false;
export const POST: APIRoute = ({ request }) => getFormSubmitResponse({ request }, "contact");
