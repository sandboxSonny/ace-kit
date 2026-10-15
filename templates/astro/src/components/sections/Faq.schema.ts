import { defineSection } from "@sandboxsonny/ace-kit";

// An FAQ is a heading and a list of questions. The questions are blocks: the editor adds as many as they like.
export default defineSection({
  handle: "faq",
  name: "FAQ",
  fields: [{ handle: "heading", label: "Heading", type: "text" }],
  blocks: {
    question: {
      name: "Question",
      fields: [
        { handle: "question", label: "Question", type: "text", required: true },
        { handle: "answer", label: "Answer", type: "richtext" },
      ],
    },
  },
});
