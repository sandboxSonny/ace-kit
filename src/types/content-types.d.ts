/** A field of a content type as `GET /public/content-types` describes it. */
export type AceFieldSchema = {
  handle: string;
  label: string;
  /** `text`, `textarea`, `select`, `number`, `checkbox`, `image`, `richtext`, `date` or `link`. */
  component_key: string;
  config: { required?: boolean; options?: string[] } | null;
};

/** A content type as `GET /public/content-types` describes it. */
export type AceContentTypeSchema = {
  handle: string;
  name: string;
  fields: AceFieldSchema[];
};
