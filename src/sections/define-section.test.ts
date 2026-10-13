import { describe, expect, expectTypeOf, it } from "vitest";

import { defineSection } from "./define-section";
import type { SectionOf } from "./define-section";
import type { AceImageData } from "../types/images";
import type { AceLinkData } from "../types/links";
import type { AceRichTextDocument } from "../types/rich-text";

const hero = defineSection({
  handle: "hero",
  name: "Hero",
  fields: [
    { handle: "heading", label: "Heading", type: "text", required: true },
    { handle: "subheading", label: "Subheading", type: "textarea" },
    { handle: "tone", label: "Tone", type: "select", options: ["calm", "loud"] },
    { handle: "picture", label: "Picture", type: "image" },
    { handle: "button", label: "Button", type: "link" },
    { handle: "stars", label: "Stars", type: "number" },
    { handle: "featured", label: "Featured", type: "checkbox" },
    { handle: "published", label: "Published", type: "date" },
    { handle: "intro", label: "Intro", type: "richtext", required: true },
  ],
});

const faq = defineSection({
  handle: "faq",
  name: "FAQ",
  fields: [{ handle: "heading", label: "Heading", type: "text" }],
  blocks: {
    question: {
      name: "Question",
      fields: [
        { handle: "question", label: "Question", type: "text", required: true },
        { handle: "answer", label: "Answer", type: "richtext" },
      ],
    },
    link: { name: "Link", fields: [{ handle: "address", label: "Address", type: "link" }] },
  },
});

const plain = defineSection({ handle: "divider", name: "Divider" });

describe("defineSection", () => {
  it("hands back exactly what it was given", () => {
    expect(hero.handle).toBe("hero");
    expect(hero.fields).toHaveLength(9);
    expect(faq.blocks.question.name).toBe("Question");
    expect(plain).toEqual({ handle: "divider", name: "Divider" });
  });
});

describe("SectionOf", () => {
  it("gives each field the type of its kind, and makes required fields required", () => {
    type Hero = SectionOf<typeof hero>;
    expectTypeOf<Hero["type"]>().toEqualTypeOf<"hero">();
    expectTypeOf<Hero["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Hero["values"]["heading"]>().toEqualTypeOf<string>();
    expectTypeOf<Hero["values"]["intro"]>().toEqualTypeOf<AceRichTextDocument>();
    expectTypeOf<Hero["values"]["subheading"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Hero["values"]["tone"]>().toEqualTypeOf<"calm" | "loud" | undefined>();
    expectTypeOf<Hero["values"]["picture"]>().toEqualTypeOf<AceImageData | undefined>();
    expectTypeOf<Hero["values"]["button"]>().toEqualTypeOf<AceLinkData | undefined>();
    expectTypeOf<Hero["values"]["stars"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Hero["values"]["featured"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Hero["values"]["published"]>().toEqualTypeOf<string | undefined>();
  });

  it("does not allow a field the section doesn't have", () => {
    type Hero = SectionOf<typeof hero>;
    // @ts-expect-error there is no such field
    type Missing = Hero["values"]["nonsense"];
    expectTypeOf<keyof Hero["values"]>().toEqualTypeOf<
      "heading" | "intro" | "subheading" | "tone" | "picture" | "button" | "stars" | "featured" | "published"
    >();
    void (undefined as unknown as Missing);
  });

  it("types blocks by their kind, so a block's values depend on its type", () => {
    type Faq = SectionOf<typeof faq>;
    expectTypeOf<Faq["type"]>().toEqualTypeOf<"faq">();
    expectTypeOf<Faq["blocks"][number]["type"]>().toEqualTypeOf<"question" | "link">();
    type Block = Faq["blocks"][number];
    expectTypeOf<Extract<Block, { type: "question" }>["values"]["question"]>().toEqualTypeOf<string>();
    expectTypeOf<Extract<Block, { type: "question" }>["values"]["answer"]>().toEqualTypeOf<
      AceRichTextDocument | undefined
    >();
    expectTypeOf<Extract<Block, { type: "link" }>["values"]["address"]>().toEqualTypeOf<AceLinkData | undefined>();
  });

  it("has no blocks, and no values, for a section that defines none", () => {
    type Divider = SectionOf<typeof plain>;
    expectTypeOf<Divider["blocks"]>().toEqualTypeOf<never[]>();
    expectTypeOf<Divider["type"]>().toEqualTypeOf<"divider">();
    expectTypeOf<keyof Divider["values"]>().toEqualTypeOf<never>();
  });
});
