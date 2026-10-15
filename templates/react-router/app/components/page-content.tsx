import type { AceEntry } from "@sandboxsonny/ace-kit";
import { AceImage, AceRichText, AceTextArea } from "@sandboxsonny/ace-kit/react-router";

import type { PageValues } from "~/types/page";

/** An entry of the "Pages" content type: its title (or headline), description, hero image and body. */
export function PageContent({ entry }: { entry: AceEntry<PageValues> }) {
  const { headline, body, hero } = entry.values;
  return (
    <section className="section">
      <div className="container prose">
        <h1>{headline || entry.title}</h1>
        {entry.description ? <p className="intro">{entry.description}</p> : null}
        {hero ? (
          <figure>
            <AceImage image={hero} sizes="(min-width: 64rem) 64rem, 100vw" lazy={false} />
          </figure>
        ) : null}
        {
          // A site made before its Body field was rich text still has plain text, with blank lines between paragraphs.
          typeof body === "string" ? (
            <AceTextArea value={body} />
          ) : body ? (
            <div className="rich-text">
              <AceRichText document={body} />
            </div>
          ) : null
        }
      </div>
    </section>
  );
}
