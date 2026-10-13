// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineSection } from "../sections/define-section";
import type { SectionOf } from "../sections/define-section";
import type { AceSection } from "../types/sections";
import { AceSections } from "./ace-sections";

afterEach(cleanup);

const heroSchema = defineSection({
  handle: "hero",
  name: "Hero",
  fields: [{ handle: "heading", label: "Heading", type: "text", required: true }],
});
const faqSchema = defineSection({
  handle: "faq",
  name: "FAQ",
  blocks: { question: { name: "Question", fields: [{ handle: "question", label: "Question", type: "text" }] } },
});

// Components typed from their own schemas, as a site writes them.
const Hero = ({ section }: { section: SectionOf<typeof heroSchema> }): ReactNode => (
  <h2 data-id={section.id}>{section.values.heading}</h2>
);
const Faq = ({ section }: { section: SectionOf<typeof faqSchema> }): ReactNode => (
  <ul data-id={section.id}>
    {section.blocks.map((block) => (
      <li key={block.id}>{block.values.question}</li>
    ))}
  </ul>
);

const sections: AceSection[] = [
  { id: "a", type: "hero", values: { heading: "Welcome" }, blocks: [] },
  {
    id: "b",
    type: "faq",
    values: {},
    blocks: [
      { id: "b1", type: "question", values: { question: "Why?" } },
      { id: "b2", type: "question", values: { question: "How?" } },
    ],
  },
  { id: "c", type: "hero", values: { heading: "Again" }, blocks: [] },
];

describe("AceSections", () => {
  it("draws each section with the component for its kind, in the order the editor put them", () => {
    // The components are listed under the handles of their schemas.
    const { container } = render(
      <AceSections sections={sections} components={{ [heroSchema.handle]: Hero, [faqSchema.handle]: Faq }} />,
    );
    expect([...container.children].map((element) => element.getAttribute("data-id"))).toEqual(["a", "b", "c"]);
    expect(screen.getByText("Welcome").tagName).toBe("H2");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Why?", "How?"]);
    expect(screen.getByText("Again")).toBeTruthy();
  });

  it("gives each component its whole section: id, kind, values and blocks", () => {
    const seen: AceSection[] = [];
    const Spy = ({ section }: { section: AceSection }): ReactNode => {
      seen.push(section);
      return null;
    };
    render(<AceSections sections={[sections[1]]} components={{ faq: Spy as never }} />);
    expect(seen).toEqual([sections[1]]);
  });

  it("draws nothing for no sections, or for something that isn't a list", () => {
    for (const value of [undefined, null, [], "text", 5, {}] as unknown as AceSection[][]) {
      const { container, unmount } = render(<AceSections sections={value} components={{ hero: Hero }} />);
      expect(container.innerHTML, String(value)).toBe("");
      unmount();
    }
  });

  describe("a kind of section with no component", () => {
    beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined));
    afterEach(() => vi.restoreAllMocks());

    it("is left out, and the rest are drawn", () => {
      const { container } = render(<AceSections sections={sections} components={{ hero: Hero }} />);
      expect([...container.children].map((element) => element.getAttribute("data-id"))).toEqual(["a", "c"]);
    });

    it("is noted in development, once for each kind", () => {
      render(
        <AceSections
          sections={[
            { id: "x", type: "carousel-one", values: {}, blocks: [] },
            { id: "y", type: "carousel-one", values: {}, blocks: [] },
          ]}
          components={{}}
        />,
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"carousel-one"'));
    });

    it("is not noted in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(<AceSections sections={[{ id: "x", type: "carousel-two", values: {}, blocks: [] }]} components={{}} />);
      expect(console.warn).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it("is drawn by the fallback when there is one", () => {
      const Fallback = ({ section }: { section: AceSection }): ReactNode => <p>Unknown: {section.type}</p>;
      render(
        <AceSections
          sections={[{ id: "x", type: "carousel", values: {}, blocks: [] }]}
          components={{}}
          fallback={Fallback}
        />,
      );
      expect(screen.getByText("Unknown: carousel")).toBeTruthy();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("cannot be a name the components object inherits", () => {
      const { container } = render(
        <AceSections
          sections={[
            { id: "x", type: "constructor", values: {}, blocks: [] },
            { id: "y", type: "toString", values: {}, blocks: [] },
          ]}
          components={{ hero: Hero }}
        />,
      );
      expect(container.innerHTML).toBe("");
    });
  });

  it("keys sections by their id, so reordering keeps each one's own state", () => {
    const { container, rerender } = render(<AceSections sections={sections} components={{ hero: Hero, faq: Faq }} />);
    const [first] = [...container.children];
    rerender(<AceSections sections={[sections[2], sections[1], sections[0]]} components={{ hero: Hero, faq: Faq }} />);
    expect([...container.children].map((element) => element.getAttribute("data-id"))).toEqual(["c", "b", "a"]);
    expect([...container.children].at(-1)).toBe(first);
  });
});
