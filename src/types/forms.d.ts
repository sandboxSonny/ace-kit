/** A field of a form, as the CMS describes it. */
export type AceFormField = {
  handle: string;
  label: string;
  kind: "text" | "email" | "textarea" | "select" | "checkbox";
  required: boolean;
  options?: string[];
};

/** A form as the CMS's public API describes it. Who is emailed is never part of it. */
export type AceForm = {
  handle: string;
  name: string;
  fields: AceFormField[];
  /** The message the owners chose to show after a visitor sends the form. */
  thank_you: string;
  /** The Cloudflare Turnstile site key, if the site's owners turned Turnstile on; otherwise an empty string. */
  turnstile_site_key: string;
};

/** What a visitor sent. */
export type AceFormSubmission = {
  /** The answers by field handle: text, or true/false for a checkbox. */
  values: Record<string, string | boolean>;
  /** The hidden spam-trap field. Always send what the browser had in it; a real visitor leaves it empty. */
  honeypot?: string;
  /** The token Cloudflare Turnstile gave the visitor's browser, when the form uses it. */
  turnstileToken?: string;
};

/** How sending a form went. `error` is written for the visitor to read. */
export type AceFormResult = { ok: true; message: string } | { ok: false; status: number; error: string };
