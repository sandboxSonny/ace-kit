import { formatAceDate } from "@sandboxsonny/ace-kit";
import type { SectionOf } from "@sandboxsonny/ace-kit";
import { AceImage } from "@sandboxsonny/ace-kit/react-router";

import type gallery from "./gallery.schema";

/** A gallery: a heading, a date and a list of photos, each a block. Its fields and blocks are in gallery.schema.ts. */
export function Gallery({ section }: { section: SectionOf<typeof gallery> }) {
  const { heading, published } = section.values;
  const photos = section.blocks.filter((block) => block.values.image || block.values.caption);
  return (
    <section className="section" data-section={section.type}>
      <div className="container">
        {heading ? <h2>{heading}</h2> : null}
        {published ? (
          <p className="gallery__note">
            <time dateTime={published}>{formatAceDate(published, { locale: "en-GB" }) ?? published}</time>
          </p>
        ) : null}
        {photos.length > 0 ? (
          <ul className="gallery__photos">
            {photos.map((photo) => (
              <li key={photo.id}>
                <figure>
                  {photo.values.image ? (
                    <AceImage image={photo.values.image} sizes="(min-width: 48rem) 20rem, 100vw" />
                  ) : null}
                  {photo.values.caption ? <figcaption>{photo.values.caption}</figcaption> : null}
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          <p className="gallery__note">No photos yet.</p>
        )}
      </div>
    </section>
  );
}
