// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AceLink, AceNotice, AceRichText, createMeta, meta, useAceMenu, useAcePreview } from "./index";
import type { AceRootData } from "../types/react-router";

afterEach(cleanup);

const rootData = (ace: Partial<AceRootData["ace"]> = {}): AceRootData => ({
  ace: { menuLinks: [], previewAdminOrigin: null, ...ace },
});

/** Renders `element` as the root route of a router whose root loader returns `data`. */
function renderInRoot(element: React.ReactNode, data: unknown = rootData()) {
  const router = createMemoryRouter([{ id: "root", path: "*", loader: () => data, element }], {
    initialEntries: ["/pages/about"],
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("useAceMenu", () => {
  function Menu() {
    return (
      <ul>
        {useAceMenu().map((link) => (
          <li key={link.to}>{link.label}</li>
        ))}
      </ul>
    );
  }

  it("gives the links the root loader loaded", async () => {
    renderInRoot(<Menu />, rootData({ menuLinks: [{ label: "About", to: "/pages/about" }] }));
    expect(await screen.findByText("About")).toBeTruthy();
  });

  it("gives nothing, rather than failing, when the root loader isn't Ace Kit's", async () => {
    renderInRoot(<Menu />, { somethingElse: true });
    expect(await screen.findByRole("list")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("useAcePreview", () => {
  const send = (origin: string) =>
    window.dispatchEvent(new MessageEvent("message", { origin, data: { type: "cms-ace:refresh" } }));
  const wait = () => new Promise((resolve) => setTimeout(resolve, 20));

  function Page({ onLoad }: { onLoad: () => void }) {
    useAcePreview();
    onLoad();
    return <p>page</p>;
  }

  it("loads the page's data again when the editor asks, but only from the admin origin", async () => {
    let loads = 0;
    const router = createMemoryRouter(
      [
        {
          id: "root",
          path: "*",
          loader: () => {
            loads += 1;
            return rootData({ previewAdminOrigin: "http://localhost:5173" });
          },
          element: <Page onLoad={() => undefined} />,
        },
      ],
      { initialEntries: ["/pages/about"] },
    );
    render(<RouterProvider router={router} />);
    await screen.findByText("page");
    expect(loads).toBe(1);

    send("https://evil.example");
    await wait();
    expect(loads).toBe(1);

    send("http://localhost:5173");
    await wait();
    expect(loads).toBe(2);
  });

  it("does nothing for a page that isn't a preview", async () => {
    let loads = 0;
    const router = createMemoryRouter(
      [{ id: "root", path: "*", loader: () => ((loads += 1), rootData()), element: <Page onLoad={vi.fn()} /> }],
      { initialEntries: ["/pages/about"] },
    );
    render(<RouterProvider router={router} />);
    await screen.findByText("page");
    send("http://localhost:5173");
    await wait();
    expect(loads).toBe(1);
  });
});

describe("AceRichText", () => {
  const document = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "inside", marks: [{ type: "link" as const, attrs: { href: "/pages/contact" } }] },
          { type: "text", text: " and " },
          { type: "text", text: "outside", marks: [{ type: "link" as const, attrs: { href: "https://example.com" } }] },
        ],
      },
    ],
  };

  it("draws links to pages of the site with the router, and the rest as plain links", async () => {
    renderInRoot(<AceRichText document={document} />);
    expect((await screen.findByRole("link", { name: "inside" })).getAttribute("href")).toBe("/pages/contact");
    expect(screen.getByRole("link", { name: "outside" }).getAttribute("href")).toBe("https://example.com");
  });
});

describe("AceLink", () => {
  it("draws a link to a page of the site with the router, and any other as a plain link", async () => {
    const router = renderInRoot(
      <>
        <AceLink link={{ href: "/pages/contact", label: "Contact us" }} className="button" />
        <AceLink link={{ href: "https://example.com", label: "Elsewhere" }} />
      </>,
    );
    const inside = await screen.findByRole("link", { name: "Contact us" });
    expect(inside.getAttribute("href")).toBe("/pages/contact");
    expect(inside.className).toBe("button");
    expect(screen.getByRole("link", { name: "Elsewhere" }).getAttribute("href")).toBe("https://example.com");

    // A router link changes the page without reloading it.
    inside.click();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/pages/contact"));
  });

  it("draws nothing for an address that can't be trusted", async () => {
    renderInRoot(
      <>
        <AceLink link={{ href: "javascript:alert(1)", label: "Click" }} />
        <p>Drawn</p>
      </>,
    );
    await screen.findByText("Drawn");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("AceNotice", () => {
  it.each([
    ["not-found", "Page not found"],
    ["unavailable", "Temporarily unavailable"],
    ["preview-expired", "Preview expired"],
  ] as const)("explains a %s", async (kind, heading) => {
    renderInRoot(<AceNotice page={{ kind, status: 404, headers: {} } as never} className="notice" />);
    expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
  });

  it("offers a way home, except from an expired preview, which has no home to go to", async () => {
    renderInRoot(<AceNotice page={{ kind: "not-found", status: 404, headers: {} }} />);
    expect(await screen.findByRole("link", { name: "Back to the home page" })).toBeTruthy();
    cleanup();
    renderInRoot(<AceNotice page={{ kind: "preview-expired", status: 403, headers: {} }} />);
    await screen.findByRole("heading", { name: "Preview expired" });
    expect(screen.queryByRole("link", { name: "Back to the home page" })).toBeNull();
  });
});

describe("meta", () => {
  const entry = {
    id: 1,
    content_type_handle: "pages",
    handle: "a",
    title: "About",
    description: "About us",
    values: {},
  };

  it("titles the page, with the site's name if given, and describes it", () => {
    expect(meta({ data: { kind: "entry", entry, headers: {} } })).toEqual([
      { title: "About" },
      { name: "description", content: "About us" },
    ]);
    expect(createMeta({ siteName: "Example Site" })({ data: { kind: "entry", entry, headers: {} } })[0]).toEqual({
      title: "About | Example Site",
    });
  });

  it("asks search engines to ignore a preview", () => {
    expect(meta({ data: { kind: "entry", entry, headers: { "Cache-Control": "no-store" } } })).toContainEqual({
      name: "robots",
      content: "noindex",
    });
  });

  it("copes with no data and with pages that aren't entries", () => {
    expect(meta({ data: undefined })).toEqual([]);
    expect(createMeta({ siteName: "Example Site" })({ data: undefined })).toEqual([{ title: "Example Site" }]);
    expect(createMeta({ siteName: "Example Site" })({ data: { kind: "not-found", headers: {} } })).toEqual([
      { title: "Example Site" },
    ]);
  });
});
