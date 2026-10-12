import type { AceImageData } from "./images";

/** A mark on a piece of text. A link's address is already worked out: an entry link comes as its path. */
export type AceRichTextMark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };

/**
 * One node of a rich text document: `paragraph`, `heading` (`attrs.level` 2 to 4), `bulletList`, `orderedList`
 * (`attrs.start`), `listItem`, `blockquote`, `hardBreak`, `text`, or `image` (`attrs.image` is the picture).
 */
export type AceRichTextNode = {
  type: string;
  attrs?: { level?: number; start?: number; assetId?: number; image?: AceImageData };
  content?: AceRichTextNode[];
  text?: string;
  marks?: AceRichTextMark[];
};

/** The value of a rich text field. */
export type AceRichTextDocument = { type: "doc"; content?: AceRichTextNode[] };
