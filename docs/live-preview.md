# Live preview

CMS Ace's editor shows your real site next to the form. It opens your site inside a frame at the entry's address with a preview token (`?cms_preview=<token>`), and every time the editor saves a draft it asks the page to refresh. For that to work a site must:

1. **Read the token and pass it on.** `loadPage` does: it hands the token to `getEntry`, which asks the API for the entry with its draft applied. A token that has run out gives `page.kind === "preview-expired"`.
2. **Never cache or index a preview.** `page.headers` has `Cache-Control: no-store` and `X-Robots-Tag: noindex` for such pages; send them (`getPage` does in Astro). Add `<meta name="robots" content="noindex">` too.
3. **Allow the admin app to frame the site, and nobody else.** Send `Content-Security-Policy: frame-ancestors 'self' <admin origin>` on every response. The Astro integration and the React Router adapter do this for you; elsewhere call `addFramingPolicy(headers, origin)` on each response, which adds the directive to any policy the site already sends instead of replacing it.
4. **Refresh when asked.** A small script listens for the editor's message, accepts it only from the admin origin, fetches the page again and swaps the content in without a reload (the scroll position stays).
   - Astro: render `<AcePreviewRefresh />` once in the layout. It knows whether the page is a preview and where the admin app is (`ACE_PREVIEW_ADMIN_ORIGIN`).
   - React: call `usePreviewRefresh(adminOrigin, refresh)` once.
   - Anything else: `listenForPreviewRefresh(adminOrigin)` from the core, in the browser.

Then, in the CMS, set the site's **Preview address** (Settings) to where the site runs. The admin app and the site must both be `http` or both `https`: browsers refuse an `http` frame inside an `https` page.

The admin origin is a setting of the site (`ACE_PREVIEW_ADMIN_ORIGIN` in Astro), because it differs between development and production.
