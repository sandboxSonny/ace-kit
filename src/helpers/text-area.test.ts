import { describe, expect, it } from "vitest";

import { renderTextArea, textAreaParagraphs, textAreaSingleLine } from "./text-area";

describe("textAreaParagraphs", () => {
  it("splits on blank lines and trims each paragraph", () => {
    expect(textAreaParagraphs("One\nstill one\n\n  Two  \r\n\r\nThree")).toEqual(["One\nstill one", "Two", "Three"]);
  });

  it("gives nothing for missing or blank text", () => {
    expect(textAreaParagraphs(undefined)).toEqual([]);
    expect(textAreaParagraphs("  \n\n ")).toEqual([]);
  });
});

describe("textAreaSingleLine", () => {
  it("turns every new line into a space", () => {
    expect(textAreaSingleLine("One\nTwo\r\n\r\n  Three  ")).toBe("One Two Three");
    expect(textAreaSingleLine(undefined)).toBe("");
  });
});

describe("renderTextArea", () => {
  it("makes paragraphs of blocks and line breaks of single new lines", () => {
    expect(renderTextArea("One\nstill one\n\nTwo")).toBe("<p>One<br>still one</p><p>Two</p>");
  });

  it("is one line without an element when it isn't multiline", () => {
    expect(renderTextArea("One\n\nTwo", { multiline: false })).toBe("One Two");
  });

  it("escapes everything, so nothing typed becomes markup", () => {
    expect(renderTextArea('<script>alert("x")</script> & more')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more</p>",
    );
    expect(renderTextArea("<b>", { multiline: false })).toBe("&lt;b&gt;");
  });

  it("is empty for missing or blank text", () => {
    expect(renderTextArea(undefined)).toBe("");
    expect(renderTextArea("  \n\n ")).toBe("");
    expect(renderTextArea(undefined, { multiline: false })).toBe("");
  });
});
