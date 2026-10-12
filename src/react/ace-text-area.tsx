import { Fragment } from "react";

import { textAreaLines, textAreaParagraphs, textAreaSingleLine } from "../helpers/text-area";

type AceTextAreaProps = {
  /** The text area field's value. Missing or blank draws nothing. */
  value: string | undefined;
  /** True (the default): blank lines start new paragraphs and a single new line is a line break. False: one line of text. */
  multiline?: boolean;
};

/**
 * A text area field's text. Multi-line text becomes `<p>` paragraphs (a new line inside one is a `<br>`); with
 * `multiline={false}` it is a single line of text with no element around it, to put inside your own. React escapes
 * the text, so it is safe as it is.
 */
export function AceTextArea({ value, multiline = true }: AceTextAreaProps) {
  if (!multiline) return <>{textAreaSingleLine(value)}</>;
  return (
    <>
      {textAreaParagraphs(value).map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {textAreaLines(paragraph).map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
