import { Link } from "react-router";

import { isInternalPath } from "../helpers/links";
import { AceRichText as BaseRichText } from "../react/ace-rich-text";
import type { AceRichTextLink } from "../react/ace-rich-text";
import type { AceRichTextDocument } from "../types/rich-text";

/** A link that stays on this site is a router `Link` (no page reload); any other is a plain `<a>`. */
const RouterLink: AceRichTextLink = ({ href, children }) =>
  isInternalPath(href) ? <Link to={href}>{children}</Link> : <a href={href}>{children}</a>;

/**
 * A rich text field's document, drawn with React Router's `Link` for links to pages of this site. Everything else
 * is as `AceRichText` from `@sandboxsonny/ace-kit/react`: safe by construction, bare elements to style yourself.
 */
export function AceRichText({ document }: { document: AceRichTextDocument }) {
  return <BaseRichText document={document} link={RouterLink} />;
}
