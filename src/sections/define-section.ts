import type { AceImageData } from "../types/images";
import type { AceLinkData } from "../types/links";
import type { AceRichTextDocument } from "../types/rich-text";

/** The kinds of field a section or block can hold. */
export type SectionFieldType =
  "text" | "textarea" | "number" | "checkbox" | "select" | "image" | "richtext" | "date" | "link";

type FieldBase = {
  /** What the field is called in the section's values: lowercase letters, numbers and hyphens. */
  handle: string;
  /** What the editor sees it called. */
  label: string;
  /** If true, the editor has to fill it in. */
  required?: boolean;
};

/** One field of a section or block. A `select` field also lists its `options`. */
export type SectionFieldDefinition =
  | (FieldBase & { type: Exclude<SectionFieldType, "select"> })
  | (FieldBase & { type: "select"; options: readonly string[] });

/** A kind of block a section can hold: one item of a list inside the section, such as one question of an FAQ. */
export type BlockDefinition = {
  name: string;
  fields?: readonly SectionFieldDefinition[];
};

/** What `defineSection` takes: a kind of section a site's code defines. */
export type SectionDefinition = {
  /** What the section is called in the CMS and in code (`type`): lowercase letters, numbers and hyphens. */
  handle: string;
  /** What the editor sees it called. */
  name: string;
  fields?: readonly SectionFieldDefinition[];
  /** The kinds of block it can hold, by handle. */
  blocks?: Readonly<Record<string, BlockDefinition>>;
};

/**
 * Describes a kind of section: its fields, and the blocks it can hold. Put one in a `*.schema.ts` file next to the
 * component that draws it, as its default export. Ace Kit syncs them to the CMS while the dev server runs (and with
 * `ace-kit sync`), and the component's props can be typed from it with `SectionOf`.
 *
 *     // Faq.schema.ts
 *     export default defineSection({
 *       handle: "faq",
 *       name: "FAQ",
 *       fields: [{ handle: "heading", label: "Heading", type: "text" }],
 *       blocks: { question: { name: "Question", fields: [{ handle: "question", label: "Question", type: "text", required: true }] } },
 *     });
 *
 * It returns the definition unchanged: its job is to check it as you write it, and to keep the exact handles and
 * types that `SectionOf` reads.
 */
export function defineSection<const Definition extends SectionDefinition>(definition: Definition): Definition {
  return definition;
}

type ValueOfField<Field> = Field extends { type: "text" | "textarea" | "date" }
  ? string
  : Field extends { type: "number" }
    ? number
    : Field extends { type: "checkbox" }
      ? boolean
      : Field extends { type: "select"; options: readonly (infer Option)[] }
        ? Option
        : Field extends { type: "image" }
          ? AceImageData
          : Field extends { type: "richtext" }
            ? AceRichTextDocument
            : Field extends { type: "link" }
              ? AceLinkData
              : unknown;

type FieldsOf<Fields> = Fields extends readonly (infer Field extends SectionFieldDefinition)[] ? Field : never;

/** The values of a list of fields: a required field is always there, any other may be missing. */
export type ValuesOfFields<Fields> = {
  [Field in FieldsOf<Fields> as Field extends { required: true } ? Field["handle"] : never]: ValueOfField<Field>;
} & {
  [Field in FieldsOf<Fields> as Field extends { required: true } ? never : Field["handle"]]?: ValueOfField<Field>;
};

type BlocksOf<Definition> = Definition extends {
  blocks: infer Blocks extends Readonly<Record<string, BlockDefinition>>;
}
  ? {
      [Handle in keyof Blocks & string]: {
        id: string;
        type: Handle;
        values: ValuesOfFields<Blocks[Handle]["fields"]>;
      };
    }[keyof Blocks & string][]
  : never[];

/**
 * A section of this kind, as a website gets it from the CMS, worked out from its definition: type the props of the
 * component that draws it with this.
 *
 *     import type { SectionOf } from "@sandboxsonny/ace-kit";
 *     import type faq from "./Faq.schema";
 *     type Props = { section: SectionOf<typeof faq> };
 */
export type SectionOf<Definition extends SectionDefinition> = {
  id: string;
  type: Definition["handle"];
  values: ValuesOfFields<Definition["fields"]>;
  blocks: BlocksOf<Definition>;
};
