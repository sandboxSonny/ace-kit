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

  it("shows the published date and the button", () => {
    show({
      kind: "entry",
      status: 200,
      entry: {
        ...entry,
        values: { ...entry.values, published: "2026-10-13", button: { href: "/pages/contact", label: "Get in touch" } },
      },
      headers: {},
    });
    expect(screen.getByText("13 October 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get in touch" }).getAttribute("href")).toBe("/pages/contact");
  });

  it("draws each section with the component for its kind, in order, and leaves out a kind it has none for", () => {
    const richText = (text: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    show({
      kind: "entry",
      status: 200,
      entry: {
        ...entry,
        values: {
          ...entry.values,
          content: [
            { id: "a", type: "hero", values: { heading: "Big news", subheading: "Read on" }, blocks: [] },
            {
              id: "b",
              type: "faq",
              values: { heading: "Questions" },
              blocks: [
                { id: "b1", type: "question", values: { question: "Why?", answer: richText("Because.") } },
                { id: "b2", type: "question", values: { question: "How?" } },
              ],
            },
            { id: "c", type: "gallery", values: { heading: "Photos" }, blocks: [] },
            { id: "d", type: "mystery", values: {}, blocks: [] },
          ],
        },
      },
      headers: {},
    });
    expect(screen.getByRole("heading", { name: "Big news" })).toBeTruthy();
    expect(screen.getByText("Read on")).toBeTruthy();
    expect(screen.getByText("Why?")).toBeTruthy();
    expect(screen.getByText("Because.")).toBeTruthy();
    expect(screen.getByText("How?")).toBeTruthy();
    expect(screen.getByText("No photos yet.")).toBeTruthy();
    const kinds = [...document.querySelectorAll("[data-section]")].map((node) => node.getAttribute("data-section"));
    expect(kinds).toEqual(["hero", "faq", "gallery"]);
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
