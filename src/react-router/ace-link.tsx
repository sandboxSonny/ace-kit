import { Link } from "react-router";

import { isInternalPath } from "../helpers/links";
import { AceLink as BaseLink } from "../react/ace-link";
import type { AceRichTextLink } from "../react/ace-rich-text";
import type { AceLinkData } from "../types/links";

/** A link that stays on this site is a router `Link` (no page reload); any other is a plain `<a>`. */
const RouterLink: AceRichTextLink = ({ href, children, className }) =>
  isInternalPath(href) ? (
    <Link to={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );

/**
 * A link field, drawn with React Router's `Link` for a page of this site. Everything else is as `AceLink` from
 * `@sandboxsonny/ace-kit/react`: its words by default, nothing drawn for an address that can't be trusted.
 */
export function AceLink({
  link,
  children,
  className,
}: {
  link: AceLinkData;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <BaseLink link={link} className={className} as={RouterLink}>
      {children}
    </BaseLink>
  );
}
