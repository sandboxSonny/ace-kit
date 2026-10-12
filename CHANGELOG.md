# @sandboxsonny/ace-kit

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
