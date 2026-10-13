# @sandboxsonny/ace-kit

## 0.5.0

### Minor Changes

- 88e17be: CMS Ace is a hosted platform, so a site no longer has to say where it is.
  
  - `ACE_API_URL` now defaults to `https://api.ace-cms.co.uk` and `ACE_PREVIEW_ADMIN_ORIGIN` to `https://app.ace-cms.co.uk` (the Astro integration, the React Router adapter and the command line). **If you develop against a CMS on your own machine, set `ACE_API_URL=http://localhost:8080` and `ACE_PREVIEW_ADMIN_ORIGIN=http://localhost:5173` in `.env`**, where before they were the defaults.
  - A site names itself with Astro's own `site` setting (`site: "https://www.example.com"`, or `astro dev --site https://www.example.com`). `ACE_SITE_DOMAIN`, when set, still wins.
  - `ace-kit sync` and `ace-kit generate` take `--site example.com` (a domain or a web address); `--domain` still works.
  - `ace-kit login` and `whoami` need no flags: with no address given they use the hosted CMS Ace.

## 0.4.0

### Minor Changes

- 7efae5a: Dev sites: against a hosted CMS, the dev server now works on your own private copy of the site instead of the live one.
  
  - On start (the Astro integration, and the `ace()` Vite plugin), the dev server finds or makes your dev site of the site `ACE_SITE_DOMAIN` names, points the site at it for as long as the server runs (`.env` is unchanged), and tells the CMS where the dev server runs so the live preview shows it.
  - Section sync goes to the dev site, so it is now allowed automatically against a hosted CMS without `ACE_SYNC_SECTIONS=remote`. The live site only changes when you run `npx ace-kit sync` yourself.
  - Without a login, or with an account that can't have a dev site, the dev server says why and shows the live site read-only, with section sync off.
  - `ACE_DEV_SITE=false` turns it off; `ACE_DEV_SITE=true` uses one even against a CMS on your own machine.
  
  Needs a CMS Ace API with dev sites (migration 00022), and a partner or super admin account.
- 7efae5a: Sections defined in code, and synced to the CMS as you work.
  
  - `defineSection` describes a kind of section (its fields, and the blocks it can hold) in a `*.schema.ts` file next to the component that draws it. `SectionOf<typeof schema>` gives the type of such a section, so a component's props follow its schema: a required field is always there, a select is the union of its options, an image is `AceImageData`, and a block's values depend on its kind.
  - While the dev server runs (the Astro integration, and the `ace()` Vite plugin on React Router), saving a schema file syncs the site's section types to the CMS. `ace-kit sync` does the same once, for a build server (with `ACE_TOKEN`). Nothing is deleted: what you take out of your code is kept in the CMS, hidden. If any schema file can't be loaded, or none are found, nothing is synced. Automatic sync only runs against a local CMS unless `ACE_SYNC_SECTIONS=remote`.
  - `AceSections` draws a sections field, giving each section to the component for its kind: `AceSections.astro`, and `AceSections` from `/react` and `/react-router`.
  - `ace-kit generate` types a sections field as `AceSection[]`.
  
  Needs a CMS Ace API with sections (migration 00019) and command-line sign-in (00020). Schema files are TypeScript: Node 22.18 or newer runs them as they are.

## 0.3.0

### Minor Changes

- a9d7700: `ace-kit login`, `ace-kit logout` and `ace-kit whoami`: sign in to CMS Ace from the command line.
  
  `ace-kit login` uses the OAuth device flow: the terminal shows a short code and opens the admin app, where you type the code and approve it. No password goes into the terminal. The login is kept in the macOS Keychain, or in a file only you can read on other systems, and is what the dev-server sync for sections will use. It can do much less than a browser login and ends after 30 days unused. Needs a CMS Ace API with command-line sign-in (its migration 00020). Set `ACE_TOKEN` to use a token instead (for a build server).
  
  `ace-kit generate` is unchanged.

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
