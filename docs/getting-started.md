# Getting started

Ace Kit is everything a website needs to use CMS Ace (see the [README](../README.md)): a typed client for the public API, addressing (`/{content type}/{entry}`), responsive images, menus, rich text, live preview support, and thin Astro and React adapters. It has no runtime dependencies.

## Starting from nothing

```sh
npx @sandboxsonny/ace-kit create my-site my-site.com
```

makes an Astro (or, with `--framework react-router`, a React Router) site with everything below already wired up. See [the command line](./command-line.md#making-a-site). To add the kit to a site you already have, read on.

## Install

```sh
npm install @sandboxsonny/ace-kit
```

(pnpm, Yarn and Bun work the same way.) Needs Node 22.12 or newer. `astro` (5 or newer), `react` (18 or newer), `react-router` (7) and `vite` are optional peer dependencies: install whichever adapter you use.

## What you import from where

| Import                                                   | What is in it                                                                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sandboxsonny/ace-kit`                                  | The framework-free core: the client, errors, `loadPage`, addressing, image attributes, menu helpers, rich text to HTML, preview helpers, all the types            |
| `@sandboxsonny/ace-kit/astro/integration`                | The Astro integration: add it to `astro.config.mjs` and an Astro site is wired up                                                                                 |
| `@sandboxsonny/ace-kit/astro`                            | What an Astro page calls: `getPage`, `getEntry`, `getEntries`, `getMenuLinks`, `getMenu`, `ace` (the client)                                                      |
| `@sandboxsonny/ace-kit/astro/AceImage.astro` and friends | Astro components: `AceImage`, `AceRichText`, `AceSeo`, `AceMenu`, `AceNotice`, `AcePreviewRefresh`                                                                |
| `@sandboxsonny/ace-kit/react`                            | `AceImage`, `AceRichText`, `usePreviewRefresh`                                                                                                                    |
| `@sandboxsonny/ace-kit/react-router`                     | React Router 7, browser-safe: `AceRichText` (router links), `AceImage`, `AceNotice`, `createMeta`, `useAceMenu`, `useAcePreview`                                  |
| `@sandboxsonny/ace-kit/react-router/server`              | React Router 7, server only: `createPageLoader`, `createRootLoader`, `handleRequest` (the server entry), `getEntry`, `getEntries`, `getMenuLinks`, `getAceClient` |
| `@sandboxsonny/ace-kit/vite`                             | A Vite plugin: reads `ACE_` settings from `.env` in development and keeps one copy of React                                                                       |
| `ace-kit` (command)                                      | `ace-kit generate` (TypeScript types for your content), `login`, `logout`, `whoami` (see [the command line](./command-line.md))                                   |

## The client

**On Astro and React Router 7 you can skip this section**: the [Astro integration](./astro.md) and the [React Router adapter](./react-router.md) make the client for you, and you call `getEntry`, `getMenuLinks` and the page loaders directly.

For anything else, create one client for the whole site, on the server. The browser never talks to the CMS API.

```ts
import { createAceClient } from "@sandboxsonny/ace-kit";

export const cms = createAceClient({
  apiUrl: "https://api.example.com", // where CMS Ace's API lives
  siteDomain: "www.example.com", // the domain this site has in the CMS
});

const about = await cms.getEntry("pages", "about"); // one entry, or null
const posts = await cms.getEntries("posts", { limit: 10 }); // a content type's live entries, newest first
const menu = await cms.getMenu("main-menu"); // a navigation menu, or null
```

- Answers are reused for 5 seconds (`cacheSeconds`, `0` turns it off), because every visitor looks like one IP address to the API's rate limit.
- A site that is not set up in the CMS, an unreachable CMS and an unexpected answer all throw `AceUnavailableError`, so a page can show "try again shortly" rather than "not found".
- Entry handles are unique across a site; `getEntry("pages", "about")` returns `null` if `about` belongs to another content type.

## Drawing pages

`loadPage` works out what to do for a request, the same way for every framework:

```ts
import { loadPage } from "@sandboxsonny/ace-kit";

const page = await loadPage(cms, { slug: "pages/about", url: new URL(request.url) });
// page.kind: "entry" | "redirect" | "not-found" | "unavailable" | "preview-expired"
// page.status, page.headers: what to send back
```

It reads `/{content type}/{entry}` addresses (as on Shopify), treats `/` as the `home` entry of `pages`, redirects `/pages/home` to `/`, and handles live preview tokens. See [Astro](./astro.md), [React Router](./react-router.md) and [React](./react.md) for routes that use it. `loadMenuLinks(client, handle, fallback)` does for menus what `getMenuLinks` does in Astro: the links, or the fallback if the menu is missing or the CMS is down.
