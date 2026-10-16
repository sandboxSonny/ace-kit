---
"@sandboxsonny/ace-kit": minor
---

Show the site's favicon in `<AceSeo>`. The favicon is chosen in the site's settings in the CMS; `<AceSeo>` adds `<link rel="icon">` and `<link rel="apple-touch-icon">` for it when you don't pass a `favicon` yourself. If your layout already has its own icon link, remove it, or the browser may pick either. `getSite()` now also returns the favicon.
