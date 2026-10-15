# Astro

Needs `astro` 5 or newer, rendering on the server (`output: "server"`) so an edit published in the CMS shows on the next page load. There is nothing to wire up by hand: add the integration, and use the functions and components.

## Set up

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import ace from "@sandboxsonny/ace-kit/astro/integration";

export default defineConfig({
  output: "server",
  integrations: [ace()],
});
```

The integration declares the site's settings, adds the middleware that lets the CMS's admin app (and only it) frame the site for [live preview](./live-preview.md), and makes Vite process the kit. The settings are read when the server starts, not baked into the build, so one build runs anywhere:

| Setting           | Default                                              | Meaning                                                   |
| ----------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `ACE_SITE_DOMAIN` | the host of Astro's `site` setting, else `localhost` | the domain this site has in the CMS (the port is ignored) |

A site connects to CMS Ace by itself and only needs to say which site it is, which it does with Astro's own `site` setting, which Astro needs for canonical addresses anyway:

```js
export default defineConfig({ site: "https://www.example.com", integrations: [ace()] });
```

To try a site without editing the config, `npm run dev -- --site https://www.example.com` does the same. `ACE_SITE_DOMAIN`, when set, wins.

## Pages

One catch-all route draws every page. `getPage` works out what to show from the address and sets the response's status and headers (a missing page is a 404, a preview is never cached or indexed):

```astro
---
// src/pages/[...slug].astro
import { getPage } from "@sandboxsonny/ace-kit/astro";
import AceNotice from "@sandboxsonny/ace-kit/astro/AceNotice.astro";

const page = await getPage(Astro);
if (page.kind === "redirect") return Astro.redirect(page.location, page.status);
---

{page.kind === "entry" ? <h1>{page.entry.title}</h1> : <AceNotice page={page} />}
```

Addresses are `/{content type}/{entry}` as on Shopify, `/` is the `home` entry of `pages`, and `/pages/home` redirects to `/`. `page.kind` is `entry`, `redirect`, `not-found`, `unavailable` or `preview-expired`. `AceNotice` draws a heading and a message for the last three; draw your own if you prefer.

## Reading content

Anywhere in a page or component:

```astro
---
import { getEntry, getEntries, getMenuLinks } from "@sandboxsonny/ace-kit/astro";

const about = await getEntry("pages", "about"); // one entry, or null
const posts = await getEntries("posts", { limit: 10 }); // a content type's entries, newest first
const links = await getMenuLinks("main-menu", { fallback: [{ label: "Home", to: "/" }] });
---
```

`getMenuLinks` returns `[{ label, to, children? }]`, ready to draw. If the site has no such menu yet, or the CMS can't be reached, you get the `fallback`, so a missing menu never takes a page down. With [typed content](./typed-content.md), `getEntry("pages", "about")` knows the shape of a page's values.

There is a client behind these (`ace` from the same import, made with the three settings) if you want `getMenu`, `getContentTypes` or the raw client.

## Components

Import them by file:

```astro
---
import AceImage from "@sandboxsonny/ace-kit/astro/AceImage.astro";
import AceLink from "@sandboxsonny/ace-kit/astro/AceLink.astro";
import AceRichText from "@sandboxsonny/ace-kit/astro/AceRichText.astro";
import AceTextArea from "@sandboxsonny/ace-kit/astro/AceTextArea.astro";
import AceMenu from "@sandboxsonny/ace-kit/astro/AceMenu.astro";
import AcePreviewRefresh from "@sandboxsonny/ace-kit/astro/AcePreviewRefresh.astro";
---

<AceMenu handle="main-menu" />
<AceImage image={entry.values.hero} sizes="(min-width: 64rem) 64rem, 100vw" lazy={false} />
<AceRichText document={entry.values.body} />
<AceLink link={entry.values.button} class="button" />
<AcePreviewRefresh />
```

- **AceMenu** draws a whole menu as a `<nav>` with nested lists, marking the current page with `aria-current="page"`. Props: `handle`, `fallback`, `label` (what a screen reader calls it) and `class`. It is deliberately unstyled (`.ace-menu`, `.ace-menu__list`, `.ace-menu__sublist` are the hooks); to control the markup, use `getMenuLinks` and draw it yourself.
- **AceImage** writes an `<img>` with `src`, `srcset`, `sizes`, `width`, `height`, `alt`, `loading` and `decoding`. Set `sizes` to how wide the image is shown, and `lazy={false}` for the image at the top of the page.
- **AceLink** draws a link field as an `<a>` with the editor's words (or the address when there are none; put your own words in the slot to replace them). Nothing is drawn if the address can't be trusted, so check for a missing link yourself if you need a fallback. A date field is plain text: `formatAceDate(entry.values.published, { locale: "en-GB" })` gives "13 October 2026", and `<time datetime={entry.values.published}>` takes the raw value.
- **AceRichText** draws a rich text field as HTML. It outputs bare elements (`h2`, `p`, `ul`, `a`...); style them from a wrapping element. Astro scopes styles, so reach them with `:global`, e.g. `.rich-text :global(h2) { ... }`.
- **AceTextArea** draws a Textarea field (plain text): `multiline` (the default) makes paragraphs of blocks and a `<br>` of a new line; `multiline={false}` is one line of text with no element around it.
- **AceSeo** goes in your layout's `<head>`: the page's `<title>`, description, canonical address, robots and Open Graph / Twitter tags, built on [astro-seo](https://github.com/jonasmerlin/astro-seo) (a site made by `ace-kit create` already depends on it; add `astro-seo` to a site you made by hand). Give it the entry and it uses the entry's SEO title and description (every content type has those two required fields), falling back to the entry's title and description, then to its own `title` and `description` props. Other props: `siteName` (ends the `<title>`, as "About us | Acme", and is the shared link's site name; leave it out if editors write the whole title), `canonical`, `image` (a full web address, for sharing) and `noindex` (set it for a draft shown in preview). On another framework, `seoProperties(options)` gives the same answer as plain data.
- **AcePreviewRefresh** goes once in your layout. It does nothing unless the page was opened by the CMS's editor.
- **AceNotice** is the message for a page that isn't an entry.

## Without the integration

The integration is what makes the settings and the middleware automatic. If you can't use it, use the framework-free [client](./getting-started.md#the-client) and `loadPage` from the core, and call `addFramingPolicy(response.headers, origin)` in your own middleware.
