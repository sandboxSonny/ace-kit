import { useAceMenu, useAcePreview } from "@sandboxsonny/ace-kit/react-router";
import { createRootLoader } from "@sandboxsonny/ace-kit/react-router/server";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import stylesheet from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

// The header's links come from the CMS menu with the handle "main-menu", or from these if the site has none yet
// or the CMS can't be reached.
export const loader = createRootLoader({
  menu: "main-menu",
  fallback: [
    { label: "Home", to: "/" },
    { label: "About", to: "/pages/about" },
    { label: "Contact", to: "/pages/contact" },
  ],
});

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useAcePreview(); // in the CMS's preview frame, redraws the page when the editor saves a draft

  return (
    <>
      <SiteHeader links={useAceMenu()} />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="section">
      <div className="container">
        <h1>{notFound ? "Page not found" : "Something went wrong"}</h1>
        <p>
          {notFound
            ? "There's nothing at this address."
            : "This page can't be shown right now. Please try again shortly."}
        </p>
        <a href="/" className="button">
          Back to the home page
        </a>
      </div>
    </main>
  );
}
