import { formatAceDate } from "@sandboxsonny/ace-kit";
import type { AceEntry } from "@sandboxsonny/ace-kit";
import { AceImage, AceLink, AceRichText, AceSections, AceTextArea } from "@sandboxsonny/ace-kit/react-router";

import { ContactForm } from "~/components/sections/contact-form";
import { Faq } from "~/components/sections/faq";
import { Gallery } from "~/components/sections/gallery";
import { Hero } from "~/components/sections/hero";
import type { PageValues } from "~/types/page";

/** An entry of the "Pages" content type: its title (or headline), description, hero image, body, button and sections. */
export function PageContent({ entry }: { entry: AceEntry<PageValues> }) {
  const { headline, body, hero, published, button, content } = entry.values;
  return (
    <>
      <section className="section">
        <div className="container prose">
          <h1>{headline || entry.title}</h1>
          {entry.description ? <p className="intro">{entry.description}</p> : null}
          {
            // A date field is a day with no time of day, so it is the same day wherever the server runs.
            published ? (
              <p className="published">
                Published <time dateTime={published}>{formatAceDate(published, { locale: "en-GB" }) ?? published}</time>
              </p>
            ) : null
          }
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
          {
            // A link field: the editor's words and where it goes, already worked out by the CMS.
            button ? (
              <p className="actions">
                <AceLink link={button} className="button" />
              </p>
            ) : null
          }
        </div>
      </section>
      <AceSections
        sections={content}
        components={{ hero: Hero, faq: Faq, gallery: Gallery, "contact-form": ContactForm }}
      />
    </>
  );
}
