import { describe, expect, it } from "vitest";

import { renderRichText } from "./rich-text";
import { linkAddress } from "./links";
import type { AceImageData } from "../types/images";
import type { AceRichTextNode } from "../types/rich-text";

const document = (...content: AceRichTextNode[]) => ({ type: "doc" as const, content });
const text = (value: string, marks?: AceRichTextNode["marks"]): AceRichTextNode => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});
const paragraph = (...content: AceRichTextNode[]): AceRichTextNode => ({ type: "paragraph", content });

const image: AceImageData = {
  id: 3,
  url: "https://cdn.test/a.png",
  src: "https://cdn.test/cdn-cgi/image/width=1280/a.png",
  srcset: "https://cdn.test/s-640.png 640w, https://cdn.test/s-1280.png 1280w",
  width: 1280,
  height: 720,
  alt_text: 'A "beach" & sea',
  content_type: "image/png",
};

describe("renderRichText", () => {
  it("draws the kinds of content a writer can use", () => {
    const html = renderRichText(
      document(
        { type: "heading", attrs: { level: 3 }, content: [text("Title")] },
        paragraph(
          text("a "),
          text("bold", [{ type: "bold" }]),
          text(" "),
          text("both", [{ type: "bold" }, { type: "italic" }]),
        ),
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("One"))] }] },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [{ type: "listItem", content: [paragraph(text("Three"))] }],
        },
        { type: "blockquote", content: [paragraph(text("Quoted"))] },
        paragraph(text("line"), { type: "hardBreak" }, text("break")),
      ),
    );
    expect(html).toBe(
      "<h3>Title</h3>" +
        "<p>a <strong>bold</strong> <em><strong>both</strong></em></p>" +
        "<ul><li><p>One</p></li></ul>" +
        '<ol start="3"><li><p>Three</p></li></ol>' +
        "<blockquote><p>Quoted</p></blockquote>" +
        "<p>line<br>break</p>",
    );
  });

  it("draws links, with an entry's address already worked out and the home page as /", () => {
    const html = renderRichText(
      document(
        paragraph(
          text("here", [{ type: "link", attrs: { href: "/pages/about" } }]),
          text("home", [{ type: "link", attrs: { href: "/pages/home" } }]),
          text("out", [{ type: "link", attrs: { href: "https://example.com/?a=1&b=2" } }]),
        ),
      ),
    );
    expect(html).toBe(
      '<p><a href="/pages/about">here</a><a href="/">home</a><a href="https://example.com/?a=1&amp;b=2">out</a></p>',
    );
  });

  it("draws an image with its sizes and escapes its alt text", () => {
    const html = renderRichText(document({ type: "image", attrs: { assetId: 3, image } }));
    expect(html).toContain('src="https://cdn.test/cdn-cgi/image/width=1280/a.png"');
    expect(html).toContain('srcset="https://cdn.test/s-640.png 640w, https://cdn.test/s-1280.png 1280w"');
    expect(html).toContain('sizes="(min-width: 42rem) 42rem, 100vw"');
    expect(html).toContain('width="1280" height="720"');
    expect(html).toContain('alt="A &quot;beach&quot; &amp; sea"');
    expect(html).toContain('loading="lazy"');
  });

  it("escapes text, so nothing a writer types becomes markup", () => {
    const html = renderRichText(document(paragraph(text('<script>alert("x")</script> & more'))));
    expect(html).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more</p>");
  });

  it("leaves out a link it doesn't trust but keeps its words", () => {
    const html = renderRichText(
      document(paragraph(text("click", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))),
    );
    expect(html).toBe("<p>click</p>");
  });

  it("leaves out kinds of content it doesn't know, and an image without its picture", () => {
    const html = renderRichText(
      document(
        { type: "script", content: [text("x")] },
        { type: "image", attrs: { assetId: 9 } },
        paragraph(text("kept")),
      ),
    );
    expect(html).toBe("<p>kept</p>");
  });

  it("falls back to a level 2 heading for an odd level, and is empty for an empty document", () => {
    expect(renderRichText(document({ type: "heading", attrs: { level: 1 }, content: [text("T")] }))).toBe("<h2>T</h2>");
    expect(renderRichText({ type: "doc" })).toBe("");
  });
});

describe("linkAddress", () => {
  it("allows paths, web addresses, mail and phone links", () => {
    for (const address of ["/", "/about", "https://example.com", "http://example.com", "mailto:a@b.co", "tel:+44123"]) {
      expect(linkAddress(address), address).toBe(address);
    }
  });

  it("refuses scripts, data addresses, protocol-relative addresses and spaces", () => {
    for (const address of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "/a b", "about", ""]) {
      expect(linkAddress(address), address).toBeNull();
    }
  });
});
