# React Router 7

Ace Kit has a React Router adapter, so a site only writes its design. It needs `react-router` 7 in framework mode with server rendering (`ssr: true`, the default), `@react-router/node`, `react-dom` and `vite`.

```
app/
  routes.ts            index + route("*") for routes/page.tsx  one route draws every page
  entry.server.tsx     one line
  root.tsx             createRootLoader + your layout and header
  routes/page.tsx      createPageLoader + your page
vite.config.ts         plugins: [ace(), reactRouter()]
```

## Set up

**1. The Vite plugin** reads the settings from `.env` in development and makes sure the site uses one copy of React:

```ts
// vite.config.ts
import ace from "@sandboxsonny/ace-kit/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [ace(), reactRouter()] });
```

The settings are environment variables, read when the server starts, so one build runs anywhere. Put them in `.env` for development and in the host's environment for production:

| Variable          | Default     | Meaning                                                   |
| ----------------- | ----------- | --------------------------------------------------------- |
| `ACE_SITE_DOMAIN` | `localhost` | the domain this site has in the CMS (the port is ignored) |

A site connects to CMS Ace by itself and only needs to say which site it is, with `ACE_SITE_DOMAIN`.

**2. The server entry**, which renders pages and lets the CMS's admin app (and only it) frame the site for [live preview](./live-preview.md):

```tsx
// app/entry.server.tsx
export { handleRequest as default, streamTimeout } from "@sandboxsonny/ace-kit/react-router/server";
```

It waits until a page is completely ready before answering (every page is fully loaded by its loader, and crawlers get whole pages). If you stream deferred data, write your own entry and call `addFramingPolicy(responseHeaders, origin)` in it.

**3. One route for every page:**

```ts
// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

// "/" is the home entry. A "*" route doesn't match "/", so the home page needs its own `index` line.
export default [
  index("routes/page.tsx", { id: "home" }),
  route("*", "routes/page.tsx", { id: "page" }),
] satisfies RouteConfig;
```

```tsx
// app/routes/page.tsx
import { AceNotice, createMeta } from "@sandboxsonny/ace-kit/react-router";
import { createPageLoader } from "@sandboxsonny/ace-kit/react-router/server";
import type { Route } from "./+types/page";

export const loader = createPageLoader();
export { headers } from "@sandboxsonny/ace-kit/react-router/server";
export const meta = createMeta({ siteName: "My Site" });

export default function Page({ loaderData: page }: Route.ComponentProps) {
  return page.kind === "entry" ? <h1>{page.entry.title}</h1> : <AceNotice page={page} />;
}
```

The loader reads the address (`/{content type}/{entry}`, and `/` is the `home` entry of `pages`), loads the entry and answers with the right status and headers: a missing page is a real 404, an unreachable CMS a 503, an expired preview a 403, `/pages/home` redirects to `/`, an address with no page follows the redirect the site's owners set up in the CMS (if any), and a preview is never cached or indexed. `page.kind` is `entry`, `not-found`, `unavailable` or `preview-expired`. `createMeta` titles the page from the entry (followed by the site's name), adds its description, and asks search engines to ignore a preview. With [typed content](./typed-content.md), `createPageLoader<PageValues>()` gives `page.entry.values` its real shape.

**4. The root route** loads the header menu and keeps previews fresh:

```tsx
// app/root.tsx
import { useAceMenu, useAcePreview } from "@sandboxsonny/ace-kit/react-router";
import { createRootLoader } from "@sandboxsonny/ace-kit/react-router/server";

export const loader = createRootLoader({
  menu: "main-menu", // the CMS menu with this handle
  fallback: [{ label: "Home", to: "/" }], // if the site has none yet, or the CMS is down
});

export default function App() {
  useAcePreview(); // in the CMS's preview frame, redraws the page when the editor saves a draft
  const links = useAceMenu(); // [{ label, to, children? }]
  return (/* your header, <Outlet />, your footer */);
}
```

`useAcePreview` and `useAceMenu` read what `createRootLoader` loaded, so call them in the root route (or anywhere below it). If your root loader loads more, spread ours into yours: `return { ...(await aceLoader(args)), other }`.

## Components

From `@sandboxsonny/ace-kit/react-router` (these are safe in the browser):

- **AceRichText** draws a rich text field. Links to pages of this site are router `Link`s, so navigating doesn't reload the page. It renders bare elements; style them from a wrapper.
- **AceLink** draws a link field. A link to a page of this site is a router `Link`; any other is a plain `<a>`. It shows the editor's words (or the address), or your children instead, and draws nothing for an address that can't be trusted. Dates are text: format them with `formatAceDate` from `@sandboxsonny/ace-kit`.
- **AceTextArea** draws a Textarea field (plain text): `multiline` (the default) makes paragraphs and line breaks, `multiline={false}` is one line of text.
- **AceImage** is an `<img>` with `src`, `srcset`, `sizes`, size and alt text. Set `sizes` to how wide it is shown, and `lazy={false}` for the image at the top of the page.
- **AceNotice** is the heading and message for a page that isn't an entry. Give it a `className`.

## Sitemap and robots.txt

Search engines find a site's pages through `/sitemap.xml` and are pointed at it by `/robots.txt`. Add two routes before the catch-all in `app/routes.ts`: `route("sitemap.xml", "routes/sitemap.tsx")` and `route("robots.txt", "routes/robots.tsx")`, whose files are one line each:

```ts
// app/routes/sitemap.tsx
export { sitemapLoader as loader } from "@sandboxsonny/ace-kit/react-router/server";
```

```ts
// app/routes/robots.tsx
export { robotsLoader as loader } from "@sandboxsonny/ace-kit/react-router/server";
```

The sitemap lists the live pages from the CMS (only the content types that have "Entries have their own pages" ticked), with when each last changed. Addresses use `https` unless the site is on `localhost`. For another address, or to keep crawlers away from a site that isn't live yet, use `createSitemapLoader({ origin })` and `createRobotsLoader({ origin, disallowAll })`.

## Reading content in your own loaders

From `@sandboxsonny/ace-kit/react-router/server`, with no client to create:

```ts
import { getEntries, getEntry, getMenuLinks } from "@sandboxsonny/ace-kit/react-router/server";

export async function loader() {
  return { posts: await getEntries("posts", { limit: 10 }) };
}
```

`getAceClient()` is the client behind them. Import these only in loaders, `headers` and `entry.server.tsx`: React Router leaves them out of the browser bundle, which is what keeps the settings and the CMS address on the server.

## Without the adapter

Everything the adapter does is built from the framework-free [core](./getting-started.md): `loadPage`, `loadMenuLinks`, `previewTokenFrom`, `addFramingPolicy`, the [React components](./react.md) and `usePreviewRefresh`. The adapter is about 150 lines; read it if you need to do something it doesn't.

## Sections

A sections field is drawn with `AceSections`, which gives each section to the component for its kind. Each kind is a component with a `*.schema.ts` file beside it saying what an editor can fill in (see [Sections](./sections.md)):

```tsx
// app/components/page-content.tsx
import { AceSections } from "@sandboxsonny/ace-kit/react-router";

import { Hero } from "~/components/sections/hero";

<AceSections sections={entry.values.content} components={{ hero: Hero }} />;
```

```tsx
// app/components/sections/hero.tsx, typed from hero.schema.ts
import type { SectionOf } from "@sandboxsonny/ace-kit";
import type hero from "./hero.schema";

export function Hero({ section }: { section: SectionOf<typeof hero> }) {
  return <h2>{section.values.heading}</h2>;
}
```

Schema files in `app/` (or `src/`) are found by `ace-kit sync`, and while `npm run dev` runs, saving one syncs it to the CMS. A new site from `npx @sandboxsonny/ace-kit create --framework react-router` comes with a hero, an FAQ and a gallery.
