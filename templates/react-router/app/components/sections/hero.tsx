import type { SectionOf } from "@sandboxsonny/ace-kit";
import { AceImage, AceLink } from "@sandboxsonny/ace-kit/react-router";

import type hero from "./hero.schema";

/** A hero: a heading, an optional subheading and button, and an optional picture. Its fields are in hero.schema.ts. */
export function Hero({ section }: { section: SectionOf<typeof hero> }) {
  const { heading, subheading, picture, button } = section.values;
  return (
    <section className="hero section--surface" data-section={section.type}>
      <div className={picture ? "container hero__inner hero__inner--with-picture" : "container hero__inner"}>
        <div>
          <h2>{heading}</h2>
          {subheading ? <p className="hero__subheading">{subheading}</p> : null}
          {button ? <AceLink link={button} className="button" /> : null}
        </div>
        {picture ? (
          <div className="hero__picture">
            <AceImage image={picture} sizes="(min-width: 64rem) 32rem, 100vw" lazy={false} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
