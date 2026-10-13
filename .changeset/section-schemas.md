---
"@sandboxsonny/ace-kit": minor
---

Sections defined in code, and synced to the CMS as you work.

- `defineSection` describes a kind of section (its fields, and the blocks it can hold) in a `*.schema.ts` file next to the component that draws it. `SectionOf<typeof schema>` gives the type of such a section, so a component's props follow its schema: a required field is always there, a select is the union of its options, an image is `AceImageData`, and a block's values depend on its kind.
- While the dev server runs (the Astro integration, and the `ace()` Vite plugin on React Router), saving a schema file syncs the site's section types to the CMS. `ace-kit sync` does the same once, for a build server (with `ACE_TOKEN`). Nothing is deleted: what you take out of your code is kept in the CMS, hidden. If any schema file can't be loaded, or none are found, nothing is synced. Automatic sync only runs against a local CMS unless `ACE_SYNC_SECTIONS=remote`.
- `AceSections` draws a sections field, giving each section to the component for its kind: `AceSections.astro`, and `AceSections` from `/react` and `/react-router`.
- `ace-kit generate` types a sections field as `AceSection[]`.

Needs a CMS Ace API with sections (migration 00019) and command-line sign-in (00020). Schema files are TypeScript: Node 22.18 or newer runs them as they are.
