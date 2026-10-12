const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => escapes[character]);

/** Paragraphs of a text area's text: blocks separated by blank lines, trimmed, with nothing empty. */
export function textAreaParagraphs(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

/** The lines inside one paragraph: a single new line in a text area is a line break. */
export const textAreaLines = (paragraph: string): string[] => paragraph.split(/\r?\n/).map((line) => line.trim());

/** Text on one line: every new line becomes a space. */
export const textAreaSingleLine = (text: string | undefined): string =>
  (text ?? "")
    .split(/\s*\r?\n\s*/)
    .filter((part) => part !== "")
    .join(" ")
    .trim();

/**
 * A text area field's text as HTML. With `multiline` (the default) blank lines start new paragraphs (`<p>`) and a
 * single new line is a line break; without it the text is one line, with no element around it. Every piece of text
 * is escaped, so the result is safe to put on a page as it is.
 */
export function renderTextArea(text: string | undefined, { multiline = true }: { multiline?: boolean } = {}): string {
  if (!multiline) return escapeHtml(textAreaSingleLine(text));
  return textAreaParagraphs(text)
    .map((paragraph) => `<p>${textAreaLines(paragraph).map(escapeHtml).join("<br>")}</p>`)
    .join("");
}
