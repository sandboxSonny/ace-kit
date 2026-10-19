---
"@sandboxsonny/ace-kit": minor
---

Per-page `noindex` and `nofollow`. Every entry now has two checkboxes in the CMS ("Hide from search engines" and "Don't follow links"); `<AceSeo>` and `seoProperties` turn them into `<meta name="robots">`, `getPage` and `loadPage` add the matching `X-Robots-Tag` header (a preview keeps its `noindex` and gains `nofollow`), and the React Router `createMeta` writes the robots tag too. `seoProperties` takes a `nofollow` option and returns `nofollow`; new exports `robotsFlags`, `robotsDirectives`, `seoNoindexHandle` and `seoNofollowHandle`. A `noindex` entry is left out of the sitemap by the CMS.
