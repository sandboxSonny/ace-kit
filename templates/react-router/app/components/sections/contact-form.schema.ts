import { defineSection } from "@sandboxsonny/ace-kit";

// A contact form is a heading, a few words above the form and the label on its button. What the form asks (name, email,
// message) lives in `app/contact.form.ts`, and who is emailed is chosen in the CMS under Forms, so an editor only
// writes the words around it here.
export default defineSection({
  handle: "contact-form",
  name: "Contact form",
  fields: [
    { handle: "heading", label: "Heading", type: "text" },
    { handle: "intro", label: "Introduction", type: "textarea" },
    { handle: "button", label: "Button text", type: "text" },
  ],
});
