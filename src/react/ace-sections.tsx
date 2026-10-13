import type { ComponentType } from "react";

import type { AceSection } from "../types/sections";

type AceSectionsProps = {
  /** An entry's sections field, as the CMS gives it: a list of sections, or nothing. */
  sections: readonly AceSection[] | null | undefined;
  /**
   * The component that draws each kind of section, by the section's `type` (the handle in its schema). Each one is
   * given the section as its `section` prop. A kind with no component is left out.
   */
  components: Readonly<Record<string, ComponentType<{ section: never }>>>;
  /** Drawn for a section whose kind has no component, instead of leaving it out. */
  fallback?: ComponentType<{ section: AceSection }>;
};

const warned = new Set<string>();

/**
 * Draws an entry's sections field: each section by the component for its kind, in the order the editor put them.
 *
 *     <AceSections sections={entry.values.content} components={{ hero: Hero, faq: Faq }} />
 *
 * `Hero` is typed from its own schema (`SectionOf<typeof heroSchema>`), and that is kept: the map only has to
 * say which component goes with which `type`.
 */
export function AceSections({ sections, components, fallback: Fallback }: AceSectionsProps) {
  if (!Array.isArray(sections)) return null;
  return (
    <>
      {sections.map((section) => {
        const Component = Object.hasOwn(components, section.type) ? components[section.type] : undefined;
        if (Component) return <Component key={section.id} section={section as never} />;
        if (Fallback) return <Fallback key={section.id} section={section} />;
        if (process.env.NODE_ENV !== "production" && !warned.has(section.type)) {
          warned.add(section.type);
          console.warn(`AceSections: no component draws the section type "${section.type}", so it was left out.`);
        }
        return null;
      })}
    </>
  );
}
