import type { SectionOf } from "@sandboxsonny/ace-kit";
import { AceRichText } from "@sandboxsonny/ace-kit/react-router";

import type faq from "./faq.schema";

/** An FAQ: a heading and a list of questions, each a block. Its fields and blocks are in faq.schema.ts. */
export function Faq({ section }: { section: SectionOf<typeof faq> }) {
  const { heading } = section.values;
  return (
    <section className="section" data-section={section.type}>
      <div className="container faq">
        {heading ? <h2>{heading}</h2> : null}
        {section.blocks.map((block) => (
          <details key={block.id}>
            <summary>{block.values.question}</summary>
            {block.values.answer ? (
              <div className="faq__answer">
                <AceRichText document={block.values.answer} />
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </section>
  );
}
