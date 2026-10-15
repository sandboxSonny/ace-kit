import { defineSection } from "@sandboxsonny/ace-kit";

// A gallery is a heading, a date and a list of photos. The photos are blocks.
export default defineSection({
  handle: "gallery",
  name: "Gallery",
  fields: [
    { handle: "heading", label: "Heading", type: "text" },
    { handle: "published", label: "Published", type: "date" },
  ],
  blocks: {
    photo: {
      name: "Photo",
      fields: [
        { handle: "image", label: "Image", type: "image" },
        { handle: "caption", label: "Caption", type: "text" },
      ],
    },
  },
});
