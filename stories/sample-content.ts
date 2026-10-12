import type { AceImageData } from "../src/types/images";
import type { AceRichTextDocument } from "../src/types/rich-text";

/** A picture to show the image components with: an inline SVG, so the stories need no network. */
const picture = (width: number, colour: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round((width * 9) / 16)}"><rect width="100%" height="100%" fill="${colour}"/></svg>`,
  )}`;

export const sampleImage: AceImageData = {
  id: 1,
  url: picture(1280, "#4f7cac"),
  src: picture(1280, "#4f7cac"),
  srcset: `${picture(640, "#4f7cac")} 640w, ${picture(1280, "#4f7cac")} 1280w`,
  width: 1280,
  height: 720,
  alt_text: "A blue rectangle standing in for a photograph",
  content_type: "image/svg+xml",
};

export const sampleDocument: AceRichTextDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A heading" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Text can be " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: ", " },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
        { type: "text", text: " or a " },
        { type: "text", text: "link to another page", marks: [{ type: "link", attrs: { href: "/pages/about" } }] },
        { type: "text", text: "." },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }] },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Starts at three" }] }] },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "A quotation." }] }] },
    { type: "image", attrs: { assetId: 1, image: sampleImage } },
  ],
};
