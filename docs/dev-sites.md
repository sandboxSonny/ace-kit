# Dev sites

When your site's dev server works against a hosted CMS, it doesn't touch the live site. It works on a **dev site**: a private copy of the site that only you can see. You can change section types, try new fields and edit test content freely; the live site, and everyone editing it, never notice.

## How it works

On start, the dev server (the Astro integration, or the `ace()` Vite plugin on React Router):

1. checks you are signed in (`npx ace-kit login`), and finds the site you are working on (Astro's `site` setting, or `ACE_SITE_DOMAIN`);
2. asks the CMS for your dev site of it, which the CMS makes the first time as a copy of the live site: its content types, section types, menus and the **text** of its entries, with every link between entries pointing at the copy. Images are not copied yet, so image fields start empty;
3. points the site at it: `ACE_SITE_DOMAIN` becomes the dev site's domain for as long as the dev server runs (your `.env` is not changed), so the site reads its content from the dev site, and section sync goes there;
4. tells the CMS where the dev server is running, so the live preview in the admin app shows your dev server.

```
[ace-kit] Made you a dev site, "Acme (dev)", as a copy of the live site (dev-3.acme.com). This dev server reads and syncs to it; the live site is not touched.
```

In the admin app the dev site appears in your Sites list with a **Dev** badge. Its Settings page has **Reset dev site**, which throws away what is in it and copies the live site again, for when you want to go back after trying something.

## Who can have one

Partner accounts and super admins, for sites they own. Ask for a partner account if the dev server says your account can't have a dev site.

## Going to the live site

A dev site is never merged into the live site. When your change is ready, deploy your site, then run `npx ace-kit sync` against the live site (`--site www.example.com`, or `ACE_SITE_DOMAIN`). Deploy first: the live CMS then has the section types the deployed code expects.

## Settings

| Setting             | Meaning                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ACE_DEV_SITE`      | `false` stops the dev server using a dev site. `true` uses one even against a CMS on your own machine. Default: on for a hosted CMS only. |
| `ACE_SYNC_SECTIONS` | See [sections](./sections.md).                                                                                                            |

## If something stops it

The dev server says so once, and carries on showing the **live site**, read-only, with section sync off: you aren't signed in (run `npx ace-kit login --api-url <address>`), your account can't have a dev site, the site isn't one you can see, or the CMS can't be reached.

## Housekeeping

A dev site nobody has used for 30 days (no one working in it, no website reading from it) is removed, with everything in it. It is also removed with the live site it was copied from. Dev sites don't count toward a partner's site limit.
