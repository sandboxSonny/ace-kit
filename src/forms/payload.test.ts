import { describe, expect, it } from "vitest";

import { defineForm } from "./define-form";
import { checkFormDefinition, formsPayload } from "./payload";

const contact = defineForm({
  handle: "contact",
  name: "Contact",
  fields: [
    { handle: "name", label: "Name", type: "text", required: true },
    { handle: "topic", label: "Topic", type: "select", options: ["Quote", "Other"] },
    { handle: "updates", label: "Send me updates", type: "checkbox" },
  ],
});

describe("checkFormDefinition", () => {
  it("accepts a good form", () => {
    expect(checkFormDefinition(contact, "contact.form.ts")).toEqual([]);
  });

  it("says what is wrong, naming the file", () => {
    const problems = checkFormDefinition(
      {
        handle: "Bad Handle",
        name: " ",
        fields: [
          { handle: "a", label: "A", type: "file" },
          { handle: "a", label: "Again", type: "text" },
          { handle: "pick", label: "Pick", type: "select" },
          { handle: "b", label: "", type: "text", required: "yes" },
          "nope",
        ],
      },
      "x.form.ts",
    );
    const text = problems.join("\n");
    expect(text).toContain("x.form.ts: needs a handle of lowercase letters");
    expect(text).toContain("x.form.ts: needs a name.");
    expect(text).toContain('field "a" has a type "file" that isn\'t one of text, email, textarea, select, checkbox');
    expect(text).toContain('field "a" is defined twice');
    expect(text).toContain('field "pick" is a select, so it needs options');
    expect(text).toContain('field "b" needs a label');
    expect(text).toContain("required that isn't true or false");
    expect(text).toContain("field 5 must be an object");
  });

  it("wants fields, and an object", () => {
    expect(checkFormDefinition({ handle: "a", name: "A" }, "f")).toEqual(["f: needs a list of fields."]);
    expect(checkFormDefinition({ handle: "a", name: "A", fields: [] }, "f")).toEqual(["f: needs a list of fields."]);
    expect(checkFormDefinition("nope", "f")).toEqual([
      "f: the default export must be the result of defineForm({ ... }).",
    ]);
  });
});

describe("formsPayload", () => {
  it("turns a form into what the CMS takes: type becomes kind, required is always spelled out", () => {
    expect(formsPayload([contact])).toEqual({
      forms: [
        {
          handle: "contact",
          name: "Contact",
          fields: [
            { handle: "name", label: "Name", kind: "text", required: true },
            { handle: "topic", label: "Topic", kind: "select", required: false, options: ["Quote", "Other"] },
            { handle: "updates", label: "Send me updates", kind: "checkbox", required: false },
          ],
        },
      ],
    });
  });
});
