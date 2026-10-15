---
"@sandboxsonny/ace-kit": minor
---

Add `AceSeo` for Astro: one component for a page's title, description, canonical address, robots and sharing tags, built on `astro-seo` (with `siteName` ending the title) and filled from the entry's SEO title and description. Every content type in the CMS now has those two required fields, so the Astro starter depends on `astro-seo`, uses `AceSeo` in its layout, and fills them in on its starter pages. `seoProperties` is exported for any other framework.
