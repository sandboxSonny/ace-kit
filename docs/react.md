# React

Needs `react` 18 or newer. The components work with any React framework (React Router, Next.js, Remix, plain Vite). **On React Router 7, use the [React Router adapter](./react-router.md) instead of wiring this up yourself.** Fetch with the [client](./getting-started.md#the-client) on the server (a loader, a server component, `getServerSideProps`), then draw.

```tsx
import { AceImage, AceLink, AceRichText } from "@sandboxsonny/ace-kit/react";
```

## AceImage

```tsx
<AceImage image={entry.values.hero} sizes="(min-width: 64rem) 64rem, 100vw" lazy={false} className="hero" />
```

An `<img>` with `src`, `srcset`, `sizes`, `width`, `height` and `alt`. Any other `<img>` prop (`className`, `style`, `onLoad`...) is passed through. `lazy` defaults to `true`; turn it off for the image at the top of the page.

## AceLink

```tsx
{
  entry.values.button ? <AceLink link={entry.values.button} className="button" /> : null;
}
```

A link field as an `<a>` with the editor's words, or the address when there are none; children replace the words. Nothing is drawn if the address can't be trusted. Give it your router's link with `as` so navigation stays in the browser (`as={({ href, children, className }) => <Link to={href} className={className}>{children}</Link>}`).

A date field is text: `formatAceDate(entry.values.published, { locale: "en-GB" })` gives "13 October 2026" whatever the server's time zone, and `<time dateTime={entry.values.published}>` takes the raw value.

## AceRichText

```tsx
<div className="prose">
  <AceRichText document={entry.values.body} />
</div>
```

Draws a rich text field as React elements: no `dangerouslySetInnerHTML`, text is escaped by React, only the kinds of content the CMS allows are drawn, and link addresses are checked again. It renders bare elements, so style them from the wrapper.

Give it your router's link so navigation stays in the browser:

```tsx
import { Link } from "react-router";

<AceRichText document={body} link={({ href, children }) => <Link to={href}>{children}</Link>} />;
```

External links, `mailto:` and `tel:` links should stay plain `<a>`: have your `link` component check the address and fall back, if you mix them.

## AceTextArea

```tsx
<AceTextArea value={entry.values.summary} />                       {/* paragraphs; a new line is a <br> */}
<p><AceTextArea value={entry.values.tagline} multiline={false} /></p>  {/* one line, no element around it */}
```

Draws a Textarea field (plain text, not rich text). Text is escaped by React.

## Live preview

```tsx
import { usePreviewRefresh } from "@sandboxsonny/ace-kit/react";
import { useRevalidator } from "react-router";

function PreviewRefresh({ adminOrigin }: { adminOrigin: string | null }) {
  const { revalidate } = useRevalidator();
  const refresh = useCallback(() => revalidate(), [revalidate]);
  usePreviewRefresh(adminOrigin, refresh);
  return null;
}
```

Pass `adminOrigin` only for a page shown with a preview token (`previewTokenFrom(url)` tells you). See [Live preview](./live-preview.md) for the rest: call `addFramingPolicy(headers, origin)` on every response (React Router: `entry.server.tsx`), and pass `page.headers` on so a preview is never cached.

## A route in React Router 7

```tsx
// app/routes.ts: one route draws every page
export default [route("*", "routes/page.tsx")] satisfies RouteConfig;

// app/routes/page.tsx
export async function loader({ request, params }: Route.LoaderArgs) {
  const page = await loadPage(ace, { slug: params["*"], url: new URL(request.url) });
  if (page.kind === "redirect") return redirect(page.location, { status: page.status, headers: page.headers });
  return data(page, { status: page.status, headers: page.headers });
}
export const headers: Route.HeadersFunction = ({ loaderHeaders }) => loaderHeaders;

export default function Page({ loaderData: page }: Route.ComponentProps) {
  return page.kind === "entry" ? <h1>{page.entry.title}</h1> : <p>Not here</p>;
}
```

Returning `data(page, { status })` (rather than throwing) keeps a 404 or 503 inside your layout, with the header and footer.
