import { defineSection } from "@sandboxsonny/ace-kit";

// What a hero can hold. The CMS learns it from this file (the dev server syncs it when it changes), and Hero.astro's
// props are typed from it.
export default defineSection({
  handle: "hero",
  name: "Hero",
  fields: [
    { handle: "heading", label: "Heading", type: "text", required: true },
    { handle: "subheading", label: "Subheading", type: "textarea" },
    { handle: "picture", label: "Picture", type: "image" },
    { handle: "button", label: "Button", type: "link" },
  ],
});
