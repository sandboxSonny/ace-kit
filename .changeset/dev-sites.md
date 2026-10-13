---
"@sandboxsonny/ace-kit": minor
---

Dev sites: against a hosted CMS, the dev server now works on your own private copy of the site instead of the live one.

- On start (the Astro integration, and the `ace()` Vite plugin), the dev server finds or makes your dev site of the site `ACE_SITE_DOMAIN` names, points the site at it for as long as the server runs (`.env` is unchanged), and tells the CMS where the dev server runs so the live preview shows it.
- Section sync goes to the dev site, so it is now allowed automatically against a hosted CMS without `ACE_SYNC_SECTIONS=remote`. The live site only changes when you run `npx ace-kit sync` yourself.
- Without a login, or with an account that can't have a dev site, the dev server says why and shows the live site read-only, with section sync off.
- `ACE_DEV_SITE=false` turns it off; `ACE_DEV_SITE=true` uses one even against a CMS on your own machine.

Needs a CMS Ace API with dev sites (migration 00022), and a partner or super admin account.
