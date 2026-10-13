import type { ReactNode } from "react";

import { linkAttributes } from "../helpers/links";
import type { AceLinkData } from "../types/links";
import type { AceRichTextLink } from "./ace-rich-text";

type AceLinkProps = {
  /** A link field's value: `entry.values.button`. */
  link: AceLinkData;
  /** What to show instead of the editor's words, which are the default (or the address when there are none). */
  children?: ReactNode;
  className?: string;
  /** Draws the link; the default is a plain `<a>`. Give one that uses your router's link to keep navigation client-side. */
  as?: AceRichTextLink;
};

const PlainLink: AceRichTextLink = ({ href, children, className }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

/** A link field, drawn as a link. Nothing is drawn if the address can't be trusted. */
export function AceLink({ link, children, className, as: Link = PlainLink }: AceLinkProps) {
  const attributes = linkAttributes(link);
  if (!attributes) return null;
  return (
    <Link href={attributes.href} className={className}>
      {children ?? attributes.label ?? attributes.href}
    </Link>
  );
}
