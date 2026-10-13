# Typed content

The kit can write TypeScript types for your site's content types, so `getEntry` and `getEntries` return the right shape and a change in the CMS shows up as a type error in your site.

```sh
npx ace-kit generate --api-url http://localhost:8080 --domain localhost
```

or with the settings in the environment:

```sh
ACE_API_URL=http://localhost:8080 ACE_SITE_DOMAIN=localhost npx ace-kit generate
```

It reads `GET /public/content-types` (no login: it describes field names and kinds, never entries) and writes `src/ace-kit.generated.d.ts` (change it with `--out`). Make sure the file is inside your `tsconfig` `include`. Commit it, and run the command again whenever content types change (a good moment is a CI step, or a `generate` script next to `dev`).

```ts
// ace-kit.generated.d.ts (generated)
declare module "@sandboxsonny/ace-kit" {
  interface AceContentTypes {
    pages: {
      headline: string; // required fields are always there
      body?: AceRichTextDocument; // others may be missing
      hero?: AceImageData;
    };
  }
}
```

Now the content type's handle is checked and its values are typed:

```ts
const about = await cms.getEntry("pages", "about"); // AceEntry<{ headline: string; body?: ...; hero?: ... }> | null
about?.values.headline; // string
cms.getEntry("pagez", "about"); // type error: no such content type
```

| Field                            | Type                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| Text, Textarea                   | `string`                                                   |
| Number                           | `number`                                                   |
| Checkbox                         | `boolean`                                                  |
| Select                           | a union of its options, e.g. `"formal" \| "casual"`        |
| Image                            | `AceImageData`                                             |
| Rich text                        | `AceRichTextDocument`                                      |
| Date                             | `string`, a day written `YYYY-MM-DD` (see `formatAceDate`) |
| Link                             | `AceLinkData`: `{ href, label? }`                          |
| Sections                         | `AceSection[]` (see [Sections](./sections.md))             |
| a kind this version doesn't know | `unknown`                                                  |

A field is optional unless it is marked required in the CMS. Before you generate, handles are plain `string` and values are `Record<string, unknown>`, so nothing breaks.

For a content type you use in a component, name its values once: `type PageValues = AceContentTypes["pages"]`.
