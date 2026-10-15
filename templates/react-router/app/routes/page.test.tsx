import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import Page from "./page";

afterEach(cleanup);

// The loading, status codes, headers and preview handling are Ace Kit's and are tested there. This is the page's
// own part: how an entry and the notices look.
const entry = {
  id: 1,
  content_type_id: 1,
  content_type_handle: "pages",
  handle: "about",
  title: "About",
  description: "About us",
  values: {
    headline: "About this site",
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Read " },
            { type: "text", text: "more", marks: [{ type: "link", attrs: { href: "/pages/contact" } }] },
          ],
        },
      ],
    },
  },
};

const show = (page: unknown) =>
  render(
    <MemoryRouter>
      <Page loaderData={page as never} params={{ "*": "" }} matches={[] as never} />
    </MemoryRouter>,
  );

describe("the page", () => {
  it("shows an entry's headline, description and body", () => {
    show({ kind: "entry", status: 200, entry, headers: {} });
    expect(screen.getByRole("heading", { name: "About this site" })).toBeTruthy();
    expect(screen.getByText("About us")).toBeTruthy();
    expect(screen.getByRole("link", { name: "more" }).getAttribute("href")).toBe("/pages/contact");
  });

  it("shows plain text bodies, from before the field was rich text, as paragraphs", () => {
    show({ kind: "entry", status: 200, entry: { ...entry, values: { body: "One\n\nTwo" } }, headers: {} });
    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
  });

  it.each([
    ["not-found", "Page not found"],
    ["unavailable", "Temporarily unavailable"],
    ["preview-expired", "Preview expired"],
  ])("explains a %s", (kind, heading) => {
    show({ kind, status: 404, headers: {} });
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
  });
});
