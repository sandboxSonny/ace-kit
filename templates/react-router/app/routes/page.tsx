import { AceNotice, createMeta } from "@sandboxsonny/ace-kit/react-router";
import { createPageLoader } from "@sandboxsonny/ace-kit/react-router/server";

import type { Route } from "./+types/page";
import { PageContent } from "~/components/page-content";
import type { PageValues } from "~/types/page";

// Addresses are /{content type}/{entry}, as on Shopify, and "/" is the home entry. The loader works out what to
// show and answers with the right status and headers (a missing page is a real 404; a preview is never cached).
export const loader = createPageLoader<PageValues>();
export { headers } from "@sandboxsonny/ace-kit/react-router/server";
export const meta = createMeta({ siteName: "Example Site" });

export default function Page({ loaderData: page }: Route.ComponentProps) {
  return page.kind === "entry" ? (
    <PageContent entry={page.entry} />
  ) : (
    <section className="section">
      <AceNotice page={page} className="container" />
    </section>
  );
}
