# API reference

Everything below is exported from `@sandboxsonny/ace-kit` unless a path is given.

## Client

|                                                                                      |                                                                                                           |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `createAceClient({ apiUrl, siteDomain, cacheSeconds?, fetchImplementation?, now? })` | A client. `fetchImplementation` and `now` are for tests.                                                  |
| `client.getEntry(contentType, handle, { previewToken? })`                            | One live entry, or `null`. With a token, the entry it was made for with its draft applied (never cached). |
| `client.getEntries(contentType, { limit? })`                                         | A content type's live entries, newest first.                                                              |
| `client.getMenu(handle)`                                                             | A menu with every link worked out, or `null`.                                                             |
| `client.getContentTypes()`                                                           | What the content types look like (used by `ace-kit generate`).                                            |
| `AceUnavailableError`                                                                | The CMS could not be reached, or answered with something unexpected, or the site isn't set up.            |
| `AcePreviewExpiredError`                                                             | The preview token has run out.                                                                            |

## Pages and addresses

|                                                                   |                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadPage(client, { slug, url })`                                 | What to do for a request: `AcePage`, one of `entry`, `redirect`, `not-found`, `unavailable`, `preview-expired`, each with `status` and `headers`. |
| `addressFromPath(slug)`                                           | `{ contentTypeHandle, entryHandle }` for `/{content type}/{entry}`, the home entry for `/`, or `null`.                                            |
| `homeAddress`, `isHomeAddress(address)`, `pathOfAddress(address)` | The `home` entry of `pages`, and helpers.                                                                                                         |
| `visitablePath(path)`                                             | `/pages/home` becomes `/` (it redirects there); anything else is unchanged.                                                                       |

## Images

|                                            |                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `imageAttributes(image, { sizes, lazy? })` | The attributes for an `<img>`: `src`, `srcSet`, `sizes`, `width`, `height`, `alt`, `loading`, `decoding`, `fetchPriority`. |

## Links and dates

|                                |                                                                                                                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linkAttributes(link)`         | What to draw for a link field: `{ href, label }` (`label` is `null` when the editor gave no words), or `null` if the address can't be trusted.                                                                                                                                    |
| `formatAceDate(date, format?)` | A date field's day (`"2026-10-13"`) as words, in the language asked for (`{ locale: "en-GB" }`), or `null` if it isn't a real day. Takes the options of `Intl.DateTimeFormat`; the default is `dateStyle: "long"`. A day has no time of day, so it never shifts with a time zone. |

## Menus

|                                            |                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `linksFromMenu(menu)`                      | `[{ label, to, children? }]` with the home link at `/`.                    |
| `isCurrentPage(link, pathname)`            | Whether a link is the page being shown.                                    |
| `loadMenuLinks(client, handle, fallback?)` | A menu's links, or the fallback if the menu is missing or the CMS is down. |

## Rich text

|                                        |                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `renderRichText(document)`             | The document as safe HTML.                                                     |
| `linkAddress(address)`                 | The address if a link may use it, otherwise `null`.                            |
| `renderTextArea(text, { multiline? })` | A textarea field's text as safe HTML: paragraphs and line breaks, or one line. |

## Live preview

|                                                                          |                                                                                                                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `previewTokenFrom(url)`, `previewParameter`                              | The token in an address (`cms_preview`).                                                                                                                       |
| `previewHeaders`                                                         | `Cache-Control: no-store`, `X-Robots-Tag: noindex`.                                                                                                            |
| `framingPolicy(adminOrigin)`                                             | The `Content-Security-Policy` value that lets the admin app frame the site.                                                                                    |
| `addFramingPolicy(headers, adminOrigin)`                                 | Adds that policy to a response's headers, keeping any policy the site already sends (only its `frame-ancestors` is replaced). Use this in your own middleware. |
| `originOf(address)`                                                      | The origin of a web address (`https://admin.example.com`), or `null`.                                                                                          |
| `isRefreshRequest(event, adminOrigin)`, `refreshMessageType`             | Whether a message is the editor asking for a refresh, from the right origin.                                                                                   |
| `swapPageContent(current, fresh)`                                        | Swaps a page's content for a fresh copy without reloading.                                                                                                     |
| `listenForPreviewRefresh(adminOrigin, refresh?)`, `refreshPageContent()` | In the browser: refresh when the editor asks (only the admin origin counts); returns a function that stops listening.                                          |

## Types

`AceEntry<Values>`, `AceImageData`, `AceLinkData`, `AceLinkAttributes`, `AceDateFormat`, `AceMenu`, `AceMenuItem`, `AceNavigationLink`, `AceRichTextDocument`, `AceRichTextNode`, `AceRichTextMark`, `AceContentTypeSchema`, `AceFieldSchema`, `AceAddress`, `AcePage`, `AceClient`, `AceClientOptions`, `AceImageAttributes`, `AceImageOptions`, and the ones generation fills in: `AceContentTypes`, `AceContentTypeHandle`, `AceValuesOf`.

## Astro

`@sandboxsonny/ace-kit/astro/integration`: the integration (default export), `ace()`.

`@sandboxsonny/ace-kit/astro` (uses the integration's settings, so there is no client to create):

|                                                                                           |                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPage(Astro)`                                                                          | What to show for the page being requested; also sets the response's status and headers. A `redirect` is returned for you to act on with `Astro.redirect`. |
| `getEntry(contentType, handle)`, `getEntries(contentType, { limit? })`, `getMenu(handle)` | As on the client.                                                                                                                                         |
| `getMenuLinks(handle, { fallback? })`                                                     | A menu's links, or the fallback if the menu is missing or the CMS is down.                                                                                |
| `applyPage(response, page)`                                                               | Puts a page's status and headers on a response.                                                                                                           |
| `ace`                                                                                     | The client these use.                                                                                                                                     |

Components, by file: `AceImage.astro`, `AceLink.astro`, `AceRichText.astro`, `AceTextArea.astro`, `AceMenu.astro`, `AceNotice.astro`, `AcePreviewRefresh.astro`.

## React Router 7

`@sandboxsonny/ace-kit/vite`: the plugin (default export), `ace()`.

`@sandboxsonny/ace-kit/react-router` (browser-safe):

|                                                                  |                                                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `AceRichText`, `AceTextArea`, `AceImage`, `AceLink`, `AceNotice` | Components; rich text links and `AceLink` are router links for pages of the site. |
| `createMeta({ siteName? })`, `meta`                              | The route's `meta`.                                                               |
| `useAceMenu()`, `useAcePreview()`                                | Read the header menu; keep a preview fresh. Need `createRootLoader`.              |

`@sandboxsonny/ace-kit/react-router/server` (server only):

|                                                                     |                                                                  |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `createPageLoader<Values>()`, `loader`                              | The loader for the catch-all route that draws every page.        |
| `headers`                                                           | The route's `headers` export.                                    |
| `createRootLoader({ menu, fallback? })`                             | The root loader: the menu's links and whether this is a preview. |
| `handleRequest`, `streamTimeout`                                    | The server entry.                                                |
| `getEntry`, `getEntries`, `getMenu`, `getMenuLinks`, `getAceClient` | Read content from your own loaders.                              |

## React (`@sandboxsonny/ace-kit/react`)

`AceImage`, `AceLink` (with `as`), `AceRichText` (with `link`), `usePreviewRefresh(adminOrigin, refresh?)`.
