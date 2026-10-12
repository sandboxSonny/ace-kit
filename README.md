# Ace Kit

The website-side toolkit for **CMS Ace**: everything a site needs to read its content, draw it safely and support live preview, for Astro and React Router 7, with plain React and framework-free pieces underneath.

- **A typed client** for the CMS Ace public API.
- **Addressing, menus and images** ready to draw: `/{content type}/{entry}` pages, nested menus, responsive `<img>` attributes.
- **Rich text** rendered safely (escaped, links checked) as Astro, React or an HTML string.
- **Live preview** support: the framing header, the no-cache headers and the script that refreshes a page when the editor saves.
- **Typed content**: `ace-kit generate` writes TypeScript types for your content types, so a change in the CMS shows up as a type error.
- **No runtime dependencies**, ES modules with types, Node 22.12 or newer.

> **You need a CMS Ace API to use it.** CMS Ace is a separate product and is not part of this repository; Ace Kit is the open source client side of it.

```sh
npm install @sandboxsonny/ace-kit
```

```ts
import { createAceClient, loadPage } from "@sandboxsonny/ace-kit";

const cms = createAceClient({ apiUrl: "https://api.example.com", siteDomain: "www.example.com" });

const page = await loadPage(cms, { slug: "pages/about", url: new URL(request.url) });
if (page.kind === "entry") console.log(page.entry.title, page.entry.values);
```

On Astro there is nothing to wire up by hand: add the integration to `astro.config.mjs` (`integrations: [ace()]`), set `ACE_API_URL` and `ACE_SITE_DOMAIN`, and read the CMS straight from a page:

```astro
---
import { getEntry } from "@sandboxsonny/ace-kit/astro";
import AceImage from "@sandboxsonny/ace-kit/astro/AceImage.astro";
import AceRichText from "@sandboxsonny/ace-kit/astro/AceRichText.astro";
import AceMenu from "@sandboxsonny/ace-kit/astro/AceMenu.astro";

const about = await getEntry("pages", "about");
---

<AceMenu handle="main-menu" />
<AceImage image={about.values.hero} sizes="100vw" lazy={false} />
<AceRichText document={about.values.body} />
```

## Documentation

|                                            |                                              |
| ------------------------------------------ | -------------------------------------------- |
| [Getting started](docs/getting-started.md) | Install, the client, `loadPage`              |
| [Astro](docs/astro.md)                     | Settings, middleware, route, components      |
| [React Router](docs/react-router.md)       | The React Router 7 adapter: five small files |
| [React](docs/react.md)                     | Components for any React framework           |
| [Live preview](docs/live-preview.md)       | What a site must do for the editor's preview |
| [Typed content](docs/typed-content.md)     | `ace-kit generate`                           |
| [Rich text](docs/rich-text.md)             | The document format and how it is drawn      |
| [API reference](docs/api-reference.md)     | Every export                                 |
| [Releasing](docs/releasing.md)             | Versions, the changelog and publishing       |

The same pages, with live examples of the React components, are in Storybook: `npm run storybook`.

## Status

Ace Kit is **0.x**: it works and is tested, but until 1.0 a minor version may change an API. Every change is in the [changelog](CHANGELOG.md).

## Compatibility

Node 22.12 or newer. Astro 5 or newer, React 18 or newer, React Router 7 and Vite 5 or newer are optional: install the ones you use. A newer Ace Kit that needs a newer CMS Ace API says so in the changelog.

## Development

```sh
npm install
npm run check      # format, lint, types, tests, build, and a check of what would be published
npm run storybook  # the documentation, with live components
```

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE). The licence covers the code in this repository. It does not give a right to the names or logos "CMS Ace" or "Adams Development", and it does not cover the CMS Ace server.
