/** One block of a section, as a website gets it from the CMS, without knowing which kind it is. */
export type AceSectionBlock = {
  id: string;
  type: string;
  values: Record<string, unknown>;
};

/**
 * One section of an entry's sections field, as a website gets it from the CMS, without knowing which kind it is.
 * A component that draws one kind of section types its prop with `SectionOf<typeof schema>` instead.
 */
export type AceSection = {
  /** Steady for as long as the section exists, so a list can be keyed by it. */
  id: string;
  /** Which kind of section: the `handle` of its definition. */
  type: string;
  values: Record<string, unknown>;
  blocks: AceSectionBlock[];
};
