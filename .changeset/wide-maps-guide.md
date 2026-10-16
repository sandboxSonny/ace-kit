---
"@sandboxsonny/ace-kit": minor
---

Add a sitemap and `robots.txt`. `getSitemapResponse` and `getRobotsResponse` (Astro), and `sitemapLoader` and `robotsLoader` (React Router), each make the file in one line. The sitemap lists the site's live pages from the CMS, leaving out content types whose entries aren't pages of their own, with when each last changed. Also adds `client.getSitemap()`, and the pure `sitemapXml`, `robotsTxt` and `publicOrigin` helpers.
