import type { ComponentType, ReactNode } from "react";

import { imageAttributes } from "../helpers/images";
import { linkAddress } from "../helpers/links";
import { headingLevel, listStart, richTextImageSizes } from "../helpers/rich-text";
import type { AceRichTextDocument, AceRichTextNode } from "../types/rich-text";

/** What a link in the text is drawn with. Give one that uses your router's link to keep navigation client-side. */
export type AceRichTextLink = ComponentType<{ href: string; children: ReactNode; className?: string }>;

type AceRichTextProps = {
  document: AceRichTextDocument;
  /** Draws links; the default is a plain `<a>`. */
  link?: AceRichTextLink;
};

const PlainLink: AceRichTextLink = ({ href, children }) => <a href={href}>{children}</a>;

function renderText(node: AceRichTextNode, Link: AceRichTextLink): ReactNode {
  return (node.marks ?? []).reduce<ReactNode>((inner, mark) => {
    if (mark.type === "bold") return <strong>{inner}</strong>;
    if (mark.type === "italic") return <em>{inner}</em>;
    const address = linkAddress(mark.attrs.href);
    return address ? <Link href={address}>{inner}</Link> : inner;
  }, node.text ?? "");
}

function renderNodes(nodes: AceRichTextNode[] | undefined, Link: AceRichTextLink): ReactNode[] {
  return (nodes ?? []).map((node, index) => <Node key={index} node={node} Link={Link} />);
}

function Node({ node, Link }: { node: AceRichTextNode; Link: AceRichTextLink }): ReactNode {
  const children = renderNodes(node.content, Link);
  switch (node.type) {
    case "text":
      return renderText(node, Link);
    case "hardBreak":
      return <br />;
    case "paragraph":
      return <p>{children}</p>;
    case "heading": {
      const Heading = `h${headingLevel(node)}` as "h2" | "h3" | "h4";
      return <Heading>{children}</Heading>;
    }
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol start={listStart(node)}>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "image":
      return node.attrs?.image ? (
        <figure>
          <img {...imageAttributes(node.attrs.image, { sizes: richTextImageSizes })} />
        </figure>
      ) : null;
    default:
      // A kind of content this version doesn't know is left out rather than guessed at.
      return null;
  }
}

/**
 * A rich text field's document drawn as React elements. React escapes every piece of text, only the kinds of content
 * the CMS allows are drawn, and links are checked again, so it is safe as it is. Wrap it in your own element to style it.
 */
export function AceRichText({ document, link = PlainLink }: AceRichTextProps) {
  return <>{renderNodes(document.content, link)}</>;
}
