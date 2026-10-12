import type { AceRichTextDocument, AceRichTextMark, AceRichTextNode } from "../types/rich-text";
import { imageAttributes } from "./images";
import { linkAddress } from "./links";

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => escapes[character]);

/** How wide an image in the text is shown, so the browser picks a suitable copy from srcset. */
export const richTextImageSizes = "(min-width: 42rem) 42rem, 100vw";

/** The heading level to draw: 2 to 4, whatever the document says. */
export const headingLevel = (node: AceRichTextNode): 2 | 3 | 4 =>
  node.attrs?.level === 3 || node.attrs?.level === 4 ? node.attrs.level : 2;

/** The number an ordered list starts at, when it isn't 1. */
export const listStart = (node: AceRichTextNode): number | undefined =>
  node.attrs?.start && node.attrs.start > 1 ? Math.trunc(node.attrs.start) : undefined;

function renderImage(node: AceRichTextNode): string {
  if (!node.attrs?.image) return "";
  const attributes = imageAttributes(node.attrs.image, { sizes: richTextImageSizes });
  const parts = [
    `src="${escapeHtml(attributes.src)}"`,
    attributes.srcSet ? `srcset="${escapeHtml(attributes.srcSet)}" sizes="${escapeHtml(attributes.sizes ?? "")}"` : "",
    attributes.width ? `width="${attributes.width}"` : "",
    attributes.height ? `height="${attributes.height}"` : "",
    `alt="${escapeHtml(attributes.alt)}"`,
    'loading="lazy" decoding="async"',
  ];
  return `<figure><img ${parts.filter(Boolean).join(" ")}></figure>`;
}

function renderText(node: AceRichTextNode): string {
  const marks: AceRichTextMark[] = node.marks ?? [];
  return marks.reduce(
    (html, mark) => {
      if (mark.type === "bold") return `<strong>${html}</strong>`;
      if (mark.type === "italic") return `<em>${html}</em>`;
      const address = linkAddress(mark.attrs.href);
      return address ? `<a href="${escapeHtml(address)}">${html}</a>` : html;
    },
    escapeHtml(node.text ?? ""),
  );
}

function renderNode(node: AceRichTextNode): string {
  const inside = () => (node.content ?? []).map(renderNode).join("");
  switch (node.type) {
    case "text":
      return renderText(node);
    case "hardBreak":
      return "<br>";
    case "paragraph":
      return `<p>${inside()}</p>`;
    case "heading": {
      const level = headingLevel(node);
      return `<h${level}>${inside()}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${inside()}</ul>`;
    case "orderedList": {
      const start = listStart(node);
      return `<ol${start ? ` start="${start}"` : ""}>${inside()}</ol>`;
    }
    case "listItem":
      return `<li>${inside()}</li>`;
    case "blockquote":
      return `<blockquote>${inside()}</blockquote>`;
    case "image":
      return renderImage(node);
    default:
      // A kind of content this version doesn't know is left out rather than guessed at.
      return "";
  }
}

/**
 * A rich text document as HTML. Every piece of text and every attribute is escaped, and only the kinds of
 * content the CMS allows are drawn, so the result is safe to put on a page as it is.
 */
export function renderRichText(document: AceRichTextDocument): string {
  return (document.content ?? []).map(renderNode).join("");
}
