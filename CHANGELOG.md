# @sandboxsonny/ace-kit

## 0.2.0

### Minor Changes

- 801266d: Support for the CMS's new Date and Link field types.
  
  - `ace-kit generate` types a Date field as `string` (a day written `YYYY-MM-DD`) and a Link field as the new `AceLinkData` (`{ href, label? }`). Before, both were `unknown`.
  - `AceLink` draws a link field: `AceLink.astro` for Astro, `AceLink` from `@sandboxsonny/ace-kit/react`, and a version from `@sandboxsonny/ace-kit/react-router` that uses the router's `Link` for pages of the site. It shows the editor's words, or yours as children, and draws nothing for an address that can't be trusted.
  - `linkAttributes(link)` is what those components use, for sites that draw links their own way.
  - `formatAceDate(date, format?)` turns a Date field's day into words in any language, and never shifts the day with the server's time zone.
  
  Needs a CMS Ace API with the Date and Link field types (the API's migration 00018). Against an older API nothing changes.

## 0.1.2

### Patch Changes

- 7980e43: Server-rendered sites now identify themselves to the API with a header of their own, `X-Ace-Site-Domain`, as well as `X-Forwarded-Host`. Some platforms' proxies (Railway's, for one) rewrite `X-Forwarded-Host` on the way in, so the API could not tell which site was asking and answered "no site for this domain". Needs a CMS Ace API that reads the new header; against an older API the site works as before wherever the proxy leaves `X-Forwarded-Host` alone.

## 0.1.1

### Patch Changes

- 7cee0fb: Maintenance only, no change to the package: releases are now published with npm trusted publishing (GitHub proves its identity to npm) instead of a stored token.

## 0.1.0

### Minor Changes

- First release. Everything a website needs to use CMS Ace:
  
  - A typed client for the public API (`createAceClient`) with short-lived caching, and errors that tell "not found" apart from "the CMS is unavailable" and "the preview has expired".
  - `loadPage`, which works out what to do for a request (show an entry, redirect `/pages/home` to `/`, not found, unavailable, expired preview) the same way for every framework.
  - `/{content type}/{entry}` addressing, menu links ready to draw, and responsive image attributes (`src`, `srcset`, `sizes`, dimensions, alt text).
  - Rich text: a safe renderer for the editor's documents as HTML, plus Astro and React components.
  - `AceTextArea` (Astro, React, React Router) and `renderTextArea` for plain Textarea fields: blank lines make paragraphs, a new line a line break, or `multiline={false}` for one line of text.
  - Live preview support: framing policy, no-cache headers, and the script that refreshes the page when the editor saves a draft.
  - An Astro integration (`@sandboxsonny/ace-kit/astro/integration`): add `ace()` to `astro.config.mjs` and the settings (`ACE_API_URL`, `ACE_SITE_DOMAIN`, `ACE_PREVIEW_ADMIN_ORIGIN`), the live-preview framing middleware and a ready-made client are in place. Pages then call `getPage(Astro)`, `getEntry`, `getEntries`, `getMenu` and `getMenuLinks` directly, with no client to create.
  - Astro components: `AceImage`, `AceRichText`, `AceMenu` (a whole menu as a `<nav>`), `AceNotice` (the message for a missing, unavailable or expired page) and `AcePreviewRefresh`.
  - React components and hooks (`AceImage`, `AceRichText`, `usePreviewRefresh`).
  - A React Router 7 adapter (`@sandboxsonny/ace-kit/react-router` and `/react-router/server`) and a small Vite plugin (`/vite`): `createPageLoader` (the loader for the one route that draws every page, with real 404, 503, 403 and redirect responses), `createRootLoader` (the header menu and preview detection), `handleRequest` (a server entry that also lets the CMS frame the site for preview), `AceRichText` with router links, `AceNotice`, `createMeta`, and the `useAceMenu` and `useAcePreview` hooks. A site writes only its design: five small files.
  - `ace-kit generate`, which reads a `.env` file in the folder it runs in and writes TypeScript types for your site's content types from the CMS, so `getEntry` and `getEntries` return the right shape. Needs a CMS Ace API that has `GET /public/content-types`.
