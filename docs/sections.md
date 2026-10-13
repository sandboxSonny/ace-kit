# Sections

A **section** is a part of a page that an editor adds, fills in and reorders in the CMS: a hero, an FAQ, a gallery. You define what each kind can hold in a small file next to the component that draws it. Ace Kit sends those definitions to the CMS while your dev server runs, and types the component's props from them.

```
src/components/sections/
  Faq.astro
  Faq.schema.ts      <- what an FAQ can hold
  Hero.astro
  Hero.schema.ts
```

## Describing a section

```ts
// Faq.schema.ts
import { defineSection } from "@sandboxsonny/ace-kit";

export default defineSection({
  handle: "faq",
  name: "FAQ",
  fields: [{ handle: "heading", label: "Heading", type: "text" }],
  blocks: {
    question: {
      name: "Question",
      fields: [
        { handle: "question", label: "Question", type: "text", required: true },
        { handle: "answer", label: "Answer", type: "richtext" },
      ],
    },
  },
});
```

- **`handle`** is the section's kind in your code (`section.type`) and in the CMS: lowercase letters, numbers and hyphens. **`name`** is what the editor sees.
- **`fields`** are the section's own values. Each has a `handle`, a `label` and a `type`: `text`, `textarea`, `number`, `checkbox`, `select` (also give `options: [...]`), `image`, `richtext`, `date` or `link`. Add `required: true` to make the editor fill it in.
- **`blocks`** are the repeatable items inside a section, by handle, each with a `name` and its own `fields`. An FAQ's questions are blocks: the editor adds as many as they like and reorders them. A section without `blocks` is just fields.
- The file's **default export** must be the result of `defineSection`. Everything else in the file is ignored.

A section can't hold other sections; use blocks for a list inside one.

## Drawing sections

The component's props follow its schema, with nothing written twice:

```astro
---
// Faq.astro
import type { SectionOf } from "@sandboxsonny/ace-kit";
import type faq from "./Faq.schema";

type Props = { section: SectionOf<typeof faq> };
const { section } = Astro.props;
---

<h2>{section.values.heading}</h2>
{section.blocks.map((block) => (
  <details>
    <summary>{block.values.question}</summary>
  </details>
))}
```

`section.values.heading` is a `string | undefined` (it isn't required); `block.values.question` is a `string` (it is). An `image` is `AceImageData`, a `link` is `AceLinkData`, a `select` is the union of its options, and a block's `values` depend on its `type` when a section has more than one kind of block.

Then draw a whole sections field with the component for each kind:

```astro
---
import AceSections from "@sandboxsonny/ace-kit/astro/AceSections.astro";
import Faq from "~/components/sections/Faq.astro";
import Hero from "~/components/sections/Hero.astro";
---

<AceSections sections={entry.values.content} components={{ hero: Hero, faq: Faq }} />
```

On React and React Router the same component comes from `@sandboxsonny/ace-kit/react` and `@sandboxsonny/ace-kit/react-router`. A section whose kind has no component is left out (and noted in the dev server's log), or drawn by a `fallback` component if you give one (React). Sections are drawn in the order the editor put them.

With `ace-kit generate`, a sections field is typed `AceSection[]`: a list of sections of any kind, which is what `AceSections` takes.

## Syncing to the CMS

While the dev server runs, Ace Kit watches for `*.schema.ts` files (in `src`) and syncs them to the CMS whenever one is added, changed or removed, and once at start. It prints one line each time:

```
10:41:07 [ace-kit] Synced 3 section types (faq, gallery, hero) to localhost (http://localhost:8080).
```

You don't run anything. You do need to be signed in once: `npx ace-kit login` (see [the command line](./command-line.md)). The sync goes to the site the dev server is working on, the same one it reads its content from, and only an owner of that site (or a super admin) can sync to it.

**Your dev site, not the live one.** Against a _hosted_ CMS the dev server works on a [dev site](./dev-sites.md): your own private copy of the site, made for you the first time, so a half-written field never reaches editors or visitors of the live site. The sync goes there. Against a CMS on your own machine there is no need for one, and the sync goes to the site itself.

**If there is no dev site to sync to** (you aren't signed in, or your account can't have one), automatic sync stays off against a hosted CMS, and the dev server says why. To allow it against the live site anyway, set `ACE_SYNC_SECTIONS=remote`; to turn it off, `ACE_SYNC_SECTIONS=false`. Running `npx ace-kit sync` yourself always syncs to the site `ACE_SITE_DOMAIN` names, which is how a change reaches the live site: deploy first, then run it.

**Nothing is deleted, and a partial picture is never sent.** The CMS treats what is sent as the whole list. A section, block or field you take out of your code is kept there, hidden, so the content already written in it isn't lost (put it back and it returns). A field changing kind (say `text` to `number`) is refused, because its saved values are of the old kind: use a new handle. If any schema file can't be loaded, or none are found, **nothing is synced**; the error says which file and why.

### On a build server

`npx ace-kit sync` does the same once, in a command. With `ACE_TOKEN` set (see [the command line](./command-line.md)) it needs no browser. Schema files are TypeScript, which Node runs as it is from **Node 22.18** (use `.js` files on older versions).

## What the CMS needs

An API with sections (its migration 00019), command-line sign-in (00020) and, for dev sites, 00022.
