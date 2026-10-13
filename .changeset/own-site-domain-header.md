---
"@sandboxsonny/ace-kit": patch
---

Server-rendered sites now identify themselves to the API with a header of their own, `X-Ace-Site-Domain`, as well as `X-Forwarded-Host`. Some platforms' proxies (Railway's, for one) rewrite `X-Forwarded-Host` on the way in, so the API could not tell which site was asking and answered "no site for this domain". Needs a CMS Ace API that reads the new header; against an older API the site works as before wherever the proxy leaves `X-Forwarded-Host` alone.
