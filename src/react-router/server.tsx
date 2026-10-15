// Server-side pieces for a React Router 7 site. Import from here only in code that runs on the server: a route's
// `loader` and `headers`, the root loader and `entry.server.tsx`. React Router leaves them out of the browser bundle.
import { createReadableStreamFromReadable } from "@react-router/node";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { data, redirect, ServerRouter } from "react-router";
import type { AppLoadContext, EntryContext } from "react-router";

import { createAceClient } from "../client/create-client";
import type { AceClient } from "../client/create-client";
import { addFramingPolicy, previewTokenFrom } from "../helpers/preview";
import { loadMenuLinks } from "../helpers/menus";
import { loadPage } from "../helpers/page";
import type { AceNavigationLink } from "../types/menus";
import type { AcePage } from "../types/page";
import type { AceRootData } from "../types/react-router";
import { getAceSettings } from "./settings";

// React Router leaves this file out of the browser bundle when it is used only in a loader, `headers` or
// `entry.server.tsx`. If it does end up in the browser, say why, instead of failing with "process is not defined".
if (typeof window !== "undefined" && typeof process === "undefined") {
  throw new Error(
    "@sandboxsonny/ace-kit/react-router/server is server-only, but it was loaded in the browser. " +
      "Use it only in a route's loader, headers or entry.server.tsx, not in a component. " +
      "Components and hooks are in @sandboxsonny/ace-kit/react-router.",
  );
}

let client: AceClient | undefined;

/**
 * The client for this site, made from the settings the first time it is needed. Most code only needs the functions
 * below (`getEntry` and friends); this is for the rest of the client (`getContentTypes`).
 */
export function getAceClient(): AceClient {
  if (!client) {
    const { apiUrl, siteDomain } = getAceSettings();
    client = createAceClient({ apiUrl, siteDomain });
  }
  return client;
}

/** One live entry of a content type by its handle, or `null`. See `createAceClient`. */
export const getEntry = ((...parameters: Parameters<AceClient["getEntry"]>) =>
  getAceClient().getEntry(...parameters)) as AceClient["getEntry"];

/** A content type's live entries, newest first. */
export const getEntries = ((...parameters: Parameters<AceClient["getEntries"]>) =>
  getAceClient().getEntries(...parameters)) as AceClient["getEntries"];

/** A navigation menu with every link worked out, or `null`. */
export const getMenu = (handle: string) => getAceClient().getMenu(handle);

/**
 * A menu's links, ready to draw. If the site has no such menu, or the CMS can't be reached, you get `fallback`
 * instead, so a missing menu never takes a page down.
 */
export const getMenuLinks = (handle: string, options: { fallback?: AceNavigationLink[] } = {}) =>
  loadMenuLinks(getAceClient(), handle, options.fallback ?? []);

/**
 * The loader for the route that draws every page. The route is a catch-all, plus an index line because "*" does not match "/" (`index("routes/page.tsx", { id: "home" })` and `route("*", "routes/page.tsx", { id: "page" })`):
 *
 *     export const loader = createPageLoader<PageValues>();
 *     export { headers } from "@sandboxsonny/ace-kit/react-router/server";
 *
 * It reads the address (`/{content type}/{entry}`, with `/` the home entry), loads the entry and answers with the
 * right status and headers: a missing page is a real 404, an unreachable CMS a 503, an expired preview a 403, and
 * `/pages/home` redirects to `/`. Previews are never cached or indexed. Draw `loaderData` yourself.
 */
export function createPageLoader<Values = Record<string, unknown>>() {
  return async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\/+|\/+$/g, "");
    const page = await loadPage<Values>(getAceClient(), { slug, url });
    if (page.kind === "redirect") return redirect(page.location, { status: page.status, headers: page.headers });
    return data(page as Exclude<AcePage<Values>, { kind: "redirect" }>, { status: page.status, headers: page.headers });
  };
}

/** `createPageLoader()` for a site that has not generated types for its content. */
export const loader = createPageLoader();

/** The route's `headers`: send the ones the loader chose (a preview must never be cached or indexed). */
export const headers = ({ loaderHeaders }: { loaderHeaders: Headers }) => loaderHeaders;

/**
 * The root route's loader: the header menu's links, and whether this page is a preview shown inside the CMS's
 * editor. Read them in components with `useAceMenu()`, and call `useAcePreview()` once to keep a preview fresh.
 *
 *     export const loader = createRootLoader({ menu: "main-menu", fallback: [{ label: "Home", to: "/" }] });
 *
 * The menu is the CMS menu with that handle; `fallback` is used if the site has none yet or the CMS is down.
 */
export function createRootLoader({ menu, fallback = [] }: { menu: string; fallback?: AceNavigationLink[] }) {
  return async function loader({ request }: { request: Request }): Promise<AceRootData> {
    const menuLinks = await loadMenuLinks(getAceClient(), menu, fallback);
    // A page opened by the CMS's editor carries a preview token; only then does it listen for the editor's messages.
    const previewAdminOrigin = previewTokenFrom(new URL(request.url)) ? getAceSettings().previewAdminOrigin : null;
    return { ace: { menuLinks, previewAdminOrigin } };
  };
}

/** How long React Router waits for deferred data before giving up, as in its default server entry. */
export const streamTimeout = 5_000;

/**
 * A server entry. `app/entry.server.tsx` is one line:
 *
 *     export { handleRequest as default, streamTimeout } from "@sandboxsonny/ace-kit/react-router/server";
 *
 * It renders the page like React Router's default entry, except that it waits until the whole page is ready before
 * answering (every page here is fully loaded by its loader, and crawlers get complete HTML), and it lets the CMS's
 * admin app, and only it, frame the site for live preview (`Content-Security-Policy: frame-ancestors`).
 */
export function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
): Promise<Response> {
  addFramingPolicy(responseHeaders, getAceSettings().previewAdminOrigin);

  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return Promise.resolve(new Response(null, { status: responseStatusCode, headers: responseHeaders }));
  }

  return new Promise((resolve, reject) => {
    let statusCode = responseStatusCode;
    let shellRendered = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort(), streamTimeout + 1000);

    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={routerContext} url={request.url} />, {
      onAllReady() {
        shellRendered = true;
        const body = new PassThrough({
          final(callback) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
            callback();
          },
        });
        responseHeaders.set("Content-Type", "text/html");
        pipe(body);
        resolve(new Response(createReadableStreamFromReadable(body), { headers: responseHeaders, status: statusCode }));
      },
      onShellError(error: unknown) {
        clearTimeout(timeoutId);
        reject(error);
      },
      onError(error: unknown) {
        statusCode = 500;
        // Errors inside the shell are logged here; errors before it are rejected and logged by React Router.
        if (shellRendered) console.error(error);
      },
    });
  });
}
