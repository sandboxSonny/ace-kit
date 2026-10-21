---
"@sandboxsonny/ace-kit": minor
---

The Astro starter that `ace-kit create` copies now comes with a working contact form, a sitemap and a `robots.txt`. The Contact page is seeded with a new **Contact form** section (a heading, an introduction and the button's words; the fields live in `src/contact.form.ts`), which sends through `src/pages/api/contact.ts`, keeps spam out with a honeypot field and draws Cloudflare Turnstile once the site's owners turn it on. Messages are stored from the start and emailed once the owners add recipients under Forms in the CMS. The starter's `/sitemap.xml` and `/robots.txt` pages answer from the CMS. It also updates the starters' dev dependencies, so a new site has no `npm audit` findings. The React Router starter is unchanged for now.

The `forms.md` Astro example now types the endpoint with `APIRoute`, which the strict TypeScript config of a new site requires.
