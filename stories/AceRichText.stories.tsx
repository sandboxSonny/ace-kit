import type { Meta, StoryObj } from "@storybook/react-vite";

import { sampleDocument } from "./sample-content";
import { AceRichText } from "../src/react";

const meta = {
  title: "Components/AceRichText",
  component: AceRichText,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A rich text field's document drawn as React elements. React escapes the text, only the kinds of content the CMS allows are drawn, and link addresses are checked again. It renders bare elements: style them from a wrapper.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "42rem", lineHeight: 1.6 }}>
        <Story />
      </div>
    ),
  ],
  args: { document: sampleDocument },
} satisfies Meta<typeof AceRichText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every kind of content a writer can use. */
export const Everything: Story = {};

/** Give it your router's link so navigation stays in the browser. */
export const WithYourOwnLink: Story = {
  args: {
    link: ({ href, children }) => (
      <a href={href} style={{ color: "rebeccapurple" }} data-router-link>
        {children}
      </a>
    ),
  },
};

/** Whatever a writer types is text, never markup, and a link that could run a script is not a link. */
export const Unsafe: Story = {
  args: {
    document: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "<img src=x onerror=alert(1)> stays as words. " },
            {
              type: "text",
              text: "This is not a link.",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
  },
};

/** A kind of content this version doesn't know is left out. */
export const UnknownContent: Story = {
  args: {
    document: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before." }] },
        { type: "hologram" },
        { type: "paragraph", content: [{ type: "text", text: "After." }] },
      ],
    },
  },
};
