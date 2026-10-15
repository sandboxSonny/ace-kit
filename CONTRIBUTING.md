# Contributing

## Setting up

```sh
npm install
npm run check
```

`npm run check` is what CI runs: Prettier, ESLint, the type check, the tests, the build, and `scripts/check-package.mjs`, which checks what would be published (every file the package points at exists, the command line tool has its `#!` line, no sources or tests ship).

## Layout

```
src/
  types/        shared types, as .d.ts files named by concept
  helpers/      plain functions by concept, each with a test beside it (addressing, images, menus, preview, rich text, page loading, type generation)
  client/       the API client and its errors
  react/        React components and hooks
  react-router/ the React Router 7 adapter: browser-safe pieces (index.ts) and server pieces (server.tsx)
  vite/         the Vite plugin
  astro/        the Astro integration, middleware and the functions pages call (the components themselves are in /astro, published as they are)
  preview/      the script that runs in the browser inside the CMS's preview frame
  generate/     the `ace-kit` command line tool
astro/          Astro components (.astro)
docs/           the guides; Storybook shows these too
stories/        Storybook stories (published to https://sandboxsonny.github.io/ace-kit/ by .github/workflows/storybook.yml whenever main changes)
```

## Rules

- **Spell names out** (`request`, not `req`; ESLint enforces a list of the usual suspects).
- **Types go in `src/types/*.d.ts`** and are imported with `import type`, helpers go in `src/helpers/` by concept. The core (`src/index.ts`) imports no framework; frameworks live in `react/` and `astro/`.
- **Every change has tests**, and a change that someone using the kit would notice has a changeset (below).
- **No runtime dependencies.** The kit runs inside other people's sites; every dependency is theirs to audit too.
- **Safety is part of the job.** Rich text is rendered into other people's pages: anything that draws a document must escape text, check link addresses again, and leave out what it doesn't know. When changing a renderer, break the escaping on purpose and check a test fails.
- **Keep the renderers in step**: `helpers/rich-text.ts` (HTML) and `react/ace-rich-text.tsx` must draw the same document the same way, as described in [docs/rich-text.md](docs/rich-text.md).

## Changes and releases

Add a changeset to every pull request that changes behaviour:

```sh
npm run changeset
```

Choose the size (patch: fixes; minor: new things, backwards compatible; major: breaking) and write one or two sentences for the changelog, written for someone using the kit. See [docs/releasing.md](docs/releasing.md).
