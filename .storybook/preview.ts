import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    options: { storySort: { order: ["Introduction", "Guides", "Components"] } },
  },
};

export default preview;
