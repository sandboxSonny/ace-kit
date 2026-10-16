---
"@sandboxsonny/ace-kit": patch
---

Fix the addresses in `sitemap.xml` and `robots.txt` on a site behind a proxy. They were built from the address the server was reached at, which behind a proxy such as Railway is the server's own internal address (`http://localhost:8080`). They now use the site's domain in the CMS (`ACE_SITE_DOMAIN`) over https, and fall back to the request's address only for a site on `localhost` or a `.test` domain. Also adds `client.siteDomain`.
