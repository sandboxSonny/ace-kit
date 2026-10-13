import { describe, expect, it } from "vitest";

import { defineSection } from "./define-section";
import { checkSectionDefinition, sectionTypesPayload } from "./payload";

const good = {
  handle: "faq",
  name: "FAQ",
  fields: [{ handle: "heading", label: "Heading", type: "text" }],
  blocks: {
    question: { name: "Question", fields: [{ handle: "question", label: "Question", type: "text", required: true }] },
  },
};

describe("checkSectionDefinition", () => {
  it("accepts a good definition, a bare one, and every kind of field", () => {
    expect(checkSectionDefinition(good)).toEqual([]);
    expect(checkSectionDefinition({ handle: "divider", name: "Divider" })).toEqual([]);
    const everything = ["text", "textarea", "number", "checkbox", "image", "richtext", "date", "link"].map((type) => ({
      handle: `f-${type}`,
      label: type,
      type,
    }));
    expect(
      checkSectionDefinition({
        handle: "all",
        name: "All",
        fields: [...everything, { handle: "pick", label: "Pick", type: "select", options: ["a"] }],
      }),
    ).toEqual([]);
  });

  it("names the file's section in every message", () => {
    const problems = checkSectionDefinition({ ...good, handle: "Bad Handle" }, "Faq.schema.ts");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^Faq\.schema\.ts: needs a handle of lowercase letters/);
  });

  it.each([
    ["nothing", undefined],
    ["a string", "hero"],
    ["a list", []],
    ["a function", () => ({})],
  ])("says the default export must come from defineSection when it is %s", (_name, value) => {
    expect(checkSectionDefinition(value, "x.schema.ts")).toEqual([
      "x.schema.ts: the default export must be the result of defineSection({ ... }).",
    ]);
  });

  it("refuses a bad section handle or name", () => {
    for (const handle of [undefined, "", "Hero", "my hero", "-hero", "hero-", "he--ro", "h".repeat(65), 5]) {
      expect(checkSectionDefinition({ ...good, handle }), String(handle)).toEqual([
        expect.stringContaining("needs a handle"),
      ]);
    }
    for (const name of [undefined, "", "   ", 5, "n".repeat(201)]) {
      expect(checkSectionDefinition({ ...good, name }), String(name)).toEqual([
        expect.stringContaining("needs a name"),
      ]);
    }
  });

  it("refuses bad fields, naming the field", () => {
    const problems = (field: unknown) => checkSectionDefinition({ ...good, fields: [field] });
    expect(problems({ handle: "Heading", label: "H", type: "text" })).toEqual([
      expect.stringContaining("field 1 needs a handle"),
    ]);
    expect(problems({ handle: "heading", label: "", type: "text" })).toEqual([
      expect.stringContaining('field "heading" needs a label'),
    ]);
    expect(problems({ handle: "heading", label: "H", type: "colour" })).toEqual([
      expect.stringContaining('a type "colour" that isn\'t one of'),
    ]);
    expect(problems({ handle: "heading", label: "H" })).toEqual([
      expect.stringContaining("has a type that isn't one of"),
    ]);
    expect(problems({ handle: "heading", label: "H", type: "text", required: "yes" })).toEqual([
      expect.stringContaining("required that isn't true or false"),
    ]);
    expect(problems("heading")).toEqual([expect.stringContaining("field 1 must be an object")]);
  });

  it("does not let a section hold sections, which are not a kind of field here", () => {
    expect(
      checkSectionDefinition({ ...good, fields: [{ handle: "inner", label: "Inner", type: "sections" }] }),
    ).toEqual([expect.stringContaining("isn't one of")]);
  });

  it("needs a select to list its choices", () => {
    for (const options of [undefined, [], [""], [1], "a,b"]) {
      expect(
        checkSectionDefinition({ ...good, fields: [{ handle: "pick", label: "Pick", type: "select", options }] }),
        JSON.stringify(options),
      ).toEqual([expect.stringContaining("needs options")]);
    }
  });

  it("refuses the same field twice, in a section and in a block", () => {
    const twice = [
      { handle: "a", label: "A", type: "text" },
      { handle: "a", label: "A again", type: "text" },
    ];
    expect(checkSectionDefinition({ ...good, fields: twice })).toEqual([
      expect.stringContaining('field "a" is defined twice'),
    ]);
    expect(checkSectionDefinition({ ...good, blocks: { question: { name: "Q", fields: twice } } })).toEqual([
      expect.stringContaining('block "question": field "a" is defined twice'),
    ]);
  });

  it("refuses bad blocks", () => {
    expect(checkSectionDefinition({ ...good, blocks: [] })).toEqual([
      expect.stringContaining("blocks must be an object"),
    ]);
    expect(checkSectionDefinition({ ...good, blocks: { Question: { name: "Q" } } })).toEqual([
      expect.stringContaining('block "Question": the handle must be'),
    ]);
    expect(checkSectionDefinition({ ...good, blocks: { question: { fields: [] } } })).toEqual([
      expect.stringContaining('block "question": needs a name'),
    ]);
    expect(checkSectionDefinition({ ...good, blocks: { question: "q" } })).toEqual([
      expect.stringContaining('block "question": must be an object'),
    ]);
  });

  it("reports everything wrong at once, not just the first", () => {
    const problems = checkSectionDefinition({
      handle: "Bad",
      name: "",
      fields: [{ handle: "x", label: "", type: "nope" }],
    });
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });
});

describe("sectionTypesPayload", () => {
  it("writes definitions the way the CMS takes them", () => {
    const faq = defineSection({
      handle: "faq",
      name: "FAQ",
      fields: [
        { handle: "heading", label: "Heading", type: "text", required: true },
        { handle: "tone", label: "Tone", type: "select", options: ["calm", "loud"] },
      ],
      blocks: { question: { name: "Question", fields: [{ handle: "answer", label: "Answer", type: "richtext" }] } },
    });
    expect(sectionTypesPayload([faq])).toEqual({
      sections: [
        {
          handle: "faq",
          name: "FAQ",
          fields: [
            { handle: "heading", label: "Heading", component_key: "text", config: { required: true } },
            { handle: "tone", label: "Tone", component_key: "select", config: { options: ["calm", "loud"] } },
          ],
          blocks: [
            {
              handle: "question",
              name: "Question",
              fields: [{ handle: "answer", label: "Answer", component_key: "richtext", config: {} }],
            },
          ],
        },
      ],
    });
  });

  it("gives a bare section empty lists, and keeps the order given", () => {
    const payload = sectionTypesPayload([
      defineSection({ handle: "b", name: "B" }),
      defineSection({ handle: "a", name: "A" }),
    ]);
    expect(payload.sections.map((section) => section.handle)).toEqual(["b", "a"]);
    expect(payload.sections[0]).toEqual({ handle: "b", name: "B", fields: [], blocks: [] });
  });

  it("sends a select's options as a copy, and leaves required out when it is false", () => {
    const options = ["a", "b"] as const;
    const pick = defineSection({
      handle: "p",
      name: "P",
      fields: [{ handle: "pick", label: "Pick", type: "select", options, required: false }],
    });
    const [field] = sectionTypesPayload([pick]).sections[0].fields;
    expect(field.config).toEqual({ options: ["a", "b"] });
    expect(field.config.options).not.toBe(options);
  });
});
