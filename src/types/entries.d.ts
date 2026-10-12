/** A live entry from the public API. `Values` is the shape of its content type's fields. */
export type AceEntry<Values = Record<string, unknown>> = {
  id: number;
  content_type_id: number;
  /** The content type's handle, which is the first part of the entry's address. */
  content_type_handle: string;
  title: string;
  handle: string;
  description: string;
  values: Values;
  created_at: string;
  updated_at: string;
  /** Only on a preview: true when the entry has a draft and this is it. */
  is_draft?: boolean;
};

/**
 * The shape of each content type's values, keyed by the content type's handle. It starts empty; running
 * `ace-kit generate` fills it in for your site (by declaration merging), and the client then returns the right
 * type for each content type.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AceContentTypes {}

/** The handles of your content types once types are generated; any text before that. */
export type AceContentTypeHandle = keyof AceContentTypes extends never
  ? string
  : Extract<keyof AceContentTypes, string>;

/** The values of a content type's entries: what was generated for it, or loose before that. */
export type AceValuesOf<Handle extends string> = Handle extends keyof AceContentTypes
  ? AceContentTypes[Handle]
  : Record<string, unknown>;
