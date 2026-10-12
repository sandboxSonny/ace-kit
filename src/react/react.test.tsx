// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AceImage, AceRichText, AceTextArea, usePreviewRefresh } from "./index";
import type { AceRichTextDocument, AceRichTextNode } from "../types/rich-text";
import type { AceImageData } from "../types/images";

afterEach(cleanup);

const image: AceImageData = {
  id: 1,
  url: "https://cdn.test/a.png",
  src: "https://cdn.test/a-1280.png",
  srcset: "https://cdn.test/a-640.png 640w, https://cdn.test/a-1280.png 1280w",
  width: 1280,
  height: 720,
  alt_text: "A beach",
  content_type: "image/png",
};

const text = (value: string): AceRichTextNode => ({ type: "text", text: value });

describe("AceImage", () => {
  it("is an img with the srcset, sizes, dimensions and alt text", () => {
    const { container } = render(<AceImage image={image} sizes="100vw" className="hero" />);
    const picture = container.querySelector("img")!;
    expect(picture.getAttribute("src")).toBe(image.src);
    expect(picture.getAttribute("srcset")).toBe(image.srcset);
    expect(picture.getAttribute("sizes")).toBe("100vw");
    expect(picture.getAttribute("width")).toBe("1280");
    expect(picture.getAttribute("alt")).toBe("A beach");
    expect(picture.getAttribute("loading")).toBe("lazy");
    expect(picture.className).toBe("hero");
  });

  it("loads eagerly when it is the first thing on the page", () => {
    const { container } = render(<AceImage image={image} sizes="100vw" lazy={false} />);
    expect(container.querySelector("img")!.getAttribute("loading")).toBe("eager");
  });
});

describe("AceRichText", () => {
  const document: AceRichTextDocument = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 3 }, content: [text("Title")] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "a " },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " and " },
          { type: "text", text: "italic", marks: [{ type: "italic" }] },
          { type: "hardBreak" },
          { type: "text", text: "linked", marks: [{ type: "link", attrs: { href: "/pages/about" } }] },
        ],
      },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Three")] }] }],
      },
      { type: "blockquote", content: [{ type: "paragraph", content: [text("Quoted")] }] },
      { type: "image", attrs: { assetId: 1, image } },
    ],
  };

  it("draws the kinds of content a writer can use", () => {
    const { container } = render(<AceRichText document={document} />);
    expect(container.querySelector("h3")!.textContent).toBe("Title");
    expect(container.querySelector("strong")!.textContent).toBe("bold");
    expect(container.querySelector("em")!.textContent).toBe("italic");
    expect(container.querySelector("br")).toBeTruthy();
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/pages/about");
    expect(container.querySelector("ol")!.getAttribute("start")).toBe("3");
    expect(container.querySelector("blockquote")!.textContent).toBe("Quoted");
    expect(container.querySelector("figure img")!.getAttribute("srcset")).toBe(image.srcset);
  });

  it("escapes text and refuses links it doesn't trust, keeping their words", () => {
    const { container } = render(
      <AceRichText
        document={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "<script>alert(1)</script>" },
                { type: "text", text: "click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
              ],
            },
          ],
        }}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("<script>alert(1)</script>click");
  });

  it("draws links with the component it is given, so a router can handle them", () => {
    const { container } = render(
      <AceRichText
        document={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "go", marks: [{ type: "link", attrs: { href: "/x" } }] }],
            },
          ],
        }}
        link={({ href, children }) => (
          <a href={href} data-router="yes">
            {children}
          </a>
        )}
      />,
    );
    expect(container.querySelector("a")!.getAttribute("data-router")).toBe("yes");
  });

  it("leaves out content it doesn't know and an image without its picture", () => {
    const { container } = render(
      <AceRichText
        document={{ type: "doc", content: [{ type: "script" }, { type: "image", attrs: { assetId: 9 } }] }}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("usePreviewRefresh", () => {
  function Page({ origin, refresh }: { origin: string | null; refresh: () => Promise<void> }) {
    usePreviewRefresh(origin, refresh);
    return null;
  }
  const send = (origin: string) =>
    window.dispatchEvent(new MessageEvent("message", { origin, data: { type: "cms-ace:refresh" } }));

  it("refreshes when the admin app asks, only while mounted and only for a preview", async () => {
    const refresh = vi.fn(async () => undefined);
    const { unmount, rerender } = render(<Page origin={null} refresh={refresh} />);
    send("http://localhost:5173");
    expect(refresh).not.toHaveBeenCalled();

    rerender(<Page origin="http://localhost:5173" refresh={refresh} />);
    send("http://localhost:5173");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refresh).toHaveBeenCalledTimes(1);

    unmount();
    send("http://localhost:5173");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("AceTextArea", () => {
  it("makes paragraphs of blank-line-separated blocks, with a line break for a single new line", () => {
    const { container } = render(<AceTextArea value={"One\nstill one\n\nTwo"} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].innerHTML).toBe("One<br>still one");
    expect(paragraphs[1].textContent).toBe("Two");
  });

  it("is one line of text, with no element, when it isn't multiline", () => {
    const { container } = render(
      <span>
        <AceTextArea value={"One\n\nTwo"} multiline={false} />
      </span>,
    );
    expect(container.innerHTML).toBe("<span>One Two</span>");
  });

  it("escapes the text, and draws nothing for missing or blank text", () => {
    const { container } = render(<AceTextArea value="<script>alert(1)</script>" />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("<script>alert(1)</script>");
    cleanup();
    expect(render(<AceTextArea value={undefined} />).container.innerHTML).toBe("");
    expect(render(<AceTextArea value={"  \n\n "} />).container.innerHTML).toBe("");
  });
});
