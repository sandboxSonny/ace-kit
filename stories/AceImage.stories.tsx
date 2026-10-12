import type { Meta, StoryObj } from "@storybook/react-vite";

import { sampleImage } from "./sample-content";
import { AceImage } from "../src/react";

const meta = {
  title: "Components/AceImage",
  component: AceImage,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "An image from the CMS as an `<img>` with a web-sized `src`, a `srcset` of copies, its size (so the page doesn't jump) and its alt text. The Astro version, `AceImage.astro`, writes the same attributes.",
      },
    },
  },
  args: { image: sampleImage, sizes: "(min-width: 48rem) 48rem, 100vw" },
} satisfies Meta<typeof AceImage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Below the first screen: loaded lazily. */
export const Lazy: Story = {};

/** The image at the top of the page: loaded straight away, with priority. */
export const AtTheTopOfThePage: Story = { args: { lazy: false } };

/** Too small to need copies: no `srcset`, no `sizes`. */
export const WithoutCopies: Story = { args: { image: { ...sampleImage, srcset: "" } } };
