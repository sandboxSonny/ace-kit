---
"@sandboxsonny/ace-kit": minor
---

The React Router starter that `ace-kit create` copies now matches the Astro one: a working contact form, a sitemap and a `robots.txt`. Its Contact page is seeded with the **Contact form** section too (the fields live in `app/contact.form.ts`); the form sends through `app/routes/contact.ts` (`createFormAction`), keeps spam out with a honeypot field, and draws Cloudflare Turnstile with the React `AceTurnstile` once the site's owners turn it on. `/sitemap.xml` and `/robots.txt` are routes that use `sitemapLoader` and `robotsLoader`. Its generated types now include the SEO fields, and its `jsdom` is 30, like the Astro starter's.
