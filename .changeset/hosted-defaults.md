---
"@sandboxsonny/ace-kit": minor
---

CMS Ace is a hosted platform, so a site no longer has to say where it is.

- `ACE_API_URL` now defaults to `https://api.ace-cms.co.uk` and `ACE_PREVIEW_ADMIN_ORIGIN` to `https://app.ace-cms.co.uk` (the Astro integration, the React Router adapter and the command line). **If you develop against a CMS on your own machine, set `ACE_API_URL=http://localhost:8080` and `ACE_PREVIEW_ADMIN_ORIGIN=http://localhost:5173` in `.env`**, where before they were the defaults.
- A site names itself with Astro's own `site` setting (`site: "https://www.example.com"`, or `astro dev --site https://www.example.com`). `ACE_SITE_DOMAIN`, when set, still wins.
- `ace-kit sync` and `ace-kit generate` take `--site example.com` (a domain or a web address); `--domain` still works.
- `ace-kit login` and `whoami` need no flags: with no address given they use the hosted CMS Ace.
