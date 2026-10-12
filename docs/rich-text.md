# Rich text

A rich text field's value is a **document**: a small, safe JSON tree (no HTML in it).

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Hello" }] },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Read " },
        { "type": "text", "text": "about us", "marks": [{ "type": "link", "attrs": { "href": "/pages/about" } }] }
      ]
    },
    { "type": "image", "attrs": { "assetId": 12, "image": { "src": "...", "srcset": "...", "alt_text": "..." } } }
  ]
}
```

| Node                                  | Notes                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| `paragraph`, `blockquote`, `listItem` |                                                              |
| `heading`                             | `attrs.level` 2, 3 or 4                                      |
| `bulletList`, `orderedList`           | `orderedList` has `attrs.start` when it doesn't begin at 1   |
| `text`                                | `marks`: `bold`, `italic`, `link`                            |
| `hardBreak`                           |                                                              |
| `image`                               | `attrs.image` is the usual image object, resolved by the API |

Links arrive with their address already worked out: a link to an entry is `/{content type}/{entry}`. An image that was deleted is left out, and a link to a deleted entry keeps its words but loses the link.

## Drawing it

- **Astro:** `<AceRichText document={...} />` ([Astro](./astro.md)).
- **React:** `<AceRichText document={...} />` ([React](./react.md)).
- **Anything else:** `renderRichText(document)` returns an HTML string. Every piece of text and every attribute is escaped, so it is safe to put on a page as it is.

All three draw only what is in the table, check link addresses again (only paths, `https://`, `http://`, `mailto:` and `tel:` are links), and leave out anything they don't know, so a newer CMS can't break an older site.

## Plain text fields

A _Textarea_ field (not rich text) holds a plain string. `AceTextArea` draws it, and `multiline` says how:

```astro
<AceTextArea value={entry.values.summary} />{" "}
<!-- <p>…</p><p>…</p>: blank lines start paragraphs, a new line is a <br> -->
<p>
  <AceTextArea value={entry.values.tagline} multiline={false} />
</p>
<!-- one line of text, with no element around it -->
```

It is the same component in Astro (`AceTextArea.astro`), React and React Router (`AceTextArea`). Text is escaped. For anything else, `renderTextArea(text, { multiline })` returns the same thing as an HTML string.
