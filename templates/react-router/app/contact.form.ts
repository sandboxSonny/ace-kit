import { defineForm } from "@sandboxsonny/ace-kit";
export default defineForm({
  handle: "contact",
  name: "Contact",
  fields: [
    { handle: "name", label: "Name", type: "text", required: true },
    { handle: "email", label: "Email", type: "email", required: true },
    { handle: "message", label: "Message", type: "textarea", required: true },
  ],
});
