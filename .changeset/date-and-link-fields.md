---
"@sandboxsonny/ace-kit": minor
---

Support for the CMS's new Date and Link field types.

- `ace-kit generate` types a Date field as `string` (a day written `YYYY-MM-DD`) and a Link field as the new `AceLinkData` (`{ href, label? }`). Before, both were `unknown`.
- `AceLink` draws a link field: `AceLink.astro` for Astro, `AceLink` from `@sandboxsonny/ace-kit/react`, and a version from `@sandboxsonny/ace-kit/react-router` that uses the router's `Link` for pages of the site. It shows the editor's words, or yours as children, and draws nothing for an address that can't be trusted.
- `linkAttributes(link)` is what those components use, for sites that draw links their own way.
- `formatAceDate(date, format?)` turns a Date field's day into words in any language, and never shifts the day with the server's time zone.

Needs a CMS Ace API with the Date and Link field types (the API's migration 00018). Against an older API nothing changes.
