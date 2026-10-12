import { Link } from "react-router";

import { pageNotices } from "../helpers/notices";
import type { AcePage } from "../types/page";

/**
 * What to show for a page that isn't an entry (`page.kind` is `not-found`, `unavailable` or `preview-expired`): a heading
 * and a message, and a link home unless the preview has expired. Unstyled; give it a `className`.
 */
export function AceNotice({ page, className }: { page: Exclude<AcePage, { kind: "entry" }>; className?: string }) {
  const { heading, message } = pageNotices[page.kind];
  return (
    <div className={className}>
      <h1>{heading}</h1>
      <p>{message}</p>
      {page.kind === "preview-expired" ? null : <Link to="/">Back to the home page</Link>}
    </div>
  );
}
