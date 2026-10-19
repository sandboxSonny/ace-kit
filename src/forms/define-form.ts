/** The kinds of field a form can have. */
export type FormFieldType = "text" | "email" | "textarea" | "select" | "checkbox";

type FieldBase = {
  /** What the field is called in the submission and in the form's inputs: lowercase letters, numbers and hyphens. */
  handle: string;
  /** What the owners see it called in the CMS and in the email. */
  label: string;
  /** If true, a visitor has to fill it in (for a checkbox, tick it). */
  required?: boolean;
};

/** One field of a form. A `select` field also lists its `options`. */
export type FormFieldDefinition =
  | (FieldBase & { type: Exclude<FormFieldType, "select"> })
  | (FieldBase & { type: "select"; options: readonly string[] });

/** What `defineForm` takes: a form a site's code defines. */
export type FormDefinition = {
  /** What the form is called in the CMS and in the address its endpoint sends to: lowercase letters, numbers and hyphens. */
  handle: string;
  /** What the owners see it called. */
  name: string;
  fields: readonly FormFieldDefinition[];
};

/**
 * Describes a form: its fields. Put one in a `*.form.ts` file next to the form's component or page, as its default
 * export. Ace Kit syncs them to the CMS while the dev server runs (and with `ace-kit sync`). Who is emailed, the
 * thank-you message and how long messages are kept are set by the site's owners in the CMS, not here.
 *
 *     // contact.form.ts
 *     export default defineForm({
 *       handle: "contact",
 *       name: "Contact",
 *       fields: [
 *         { handle: "name", label: "Name", type: "text", required: true },
 *         { handle: "email", label: "Email", type: "email", required: true },
 *         { handle: "message", label: "Message", type: "textarea", required: true },
 *       ],
 *     });
 *
 * It returns the definition unchanged: its job is to check it as you write it.
 */
export function defineForm<const Definition extends FormDefinition>(definition: Definition): Definition {
  return definition;
}
