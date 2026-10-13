import type { SectionDefinition, SectionFieldDefinition, SectionFieldType } from "./define-section";

const handlePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const maximumHandleLength = 64;
const maximumNameLength = 200;

const fieldTypes: readonly SectionFieldType[] = [
  "text",
  "textarea",
  "number",
  "checkbox",
  "select",
  "image",
  "richtext",
  "date",
  "link",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHandle = (value: unknown): value is string =>
  typeof value === "string" && value.length <= maximumHandleLength && handlePattern.test(value);

const handleRule = 'lowercase letters, numbers and hyphens (such as "call-to-action")';

function checkFields(fields: unknown, where: string, problems: string[]): void {
  if (fields === undefined) return;
  if (!Array.isArray(fields)) {
    problems.push(`${where}: fields must be a list.`);
    return;
  }
  const seen = new Set<string>();
  fields.forEach((field: unknown, index) => {
    if (!isObject(field)) {
      problems.push(`${where}: field ${index + 1} must be an object with a handle, a label and a type.`);
      return;
    }
    const name = isHandle(field.handle) ? `field "${field.handle}"` : `field ${index + 1}`;
    if (!isHandle(field.handle)) problems.push(`${where}: ${name} needs a handle of ${handleRule}.`);
    else if (seen.has(field.handle)) problems.push(`${where}: ${name} is defined twice.`);
    else seen.add(field.handle);

    if (typeof field.label !== "string" || field.label.trim() === "" || field.label.length > maximumNameLength) {
      problems.push(`${where}: ${name} needs a label.`);
    }
    if (typeof field.type !== "string" || !fieldTypes.includes(field.type as SectionFieldType)) {
      const given = typeof field.type === "string" ? ` "${field.type}"` : "";
      problems.push(`${where}: ${name} has a type${given} that isn't one of ${fieldTypes.join(", ")}.`);
    } else if (field.type === "select") {
      const { options } = field;
      if (
        !Array.isArray(options) ||
        options.length === 0 ||
        options.some((option) => typeof option !== "string" || option === "")
      ) {
        problems.push(`${where}: ${name} is a select, so it needs options: a list of the choices, as text.`);
      }
    }
    if (field.required !== undefined && typeof field.required !== "boolean") {
      problems.push(`${where}: ${name} has a required that isn't true or false.`);
    }
  });
}

/**
 * Checks a section definition and returns what is wrong with it, written for the person who wrote it (an empty list
 * means it is fine). The CMS checks everything again; this is so the mistake is reported against the file, at once,
 * before anything is sent.
 */
export function checkSectionDefinition(definition: unknown, where = "this section"): string[] {
  const problems: string[] = [];
  if (!isObject(definition)) {
    return [`${where}: the default export must be the result of defineSection({ ... }).`];
  }
  if (!isHandle(definition.handle)) {
    problems.push(`${where}: needs a handle of ${handleRule}.`);
  }
  if (
    typeof definition.name !== "string" ||
    definition.name.trim() === "" ||
    definition.name.length > maximumNameLength
  ) {
    problems.push(`${where}: needs a name.`);
  }
  checkFields(definition.fields, where, problems);

  if (definition.blocks !== undefined) {
    if (!isObject(definition.blocks)) {
      problems.push(`${where}: blocks must be an object of the kinds of block, by handle.`);
    } else {
      for (const [handle, block] of Object.entries(definition.blocks)) {
        const blockWhere = `${where}, block "${handle}"`;
        if (!isHandle(handle)) problems.push(`${blockWhere}: the handle must be ${handleRule}.`);
        if (!isObject(block)) {
          problems.push(`${blockWhere}: must be an object with a name and fields.`);
          continue;
        }
        if (typeof block.name !== "string" || block.name.trim() === "") problems.push(`${blockWhere}: needs a name.`);
        checkFields(block.fields, blockWhere, problems);
      }
    }
  }
  return problems;
}

type ApiField = {
  handle: string;
  label: string;
  component_key: string;
  config: { required?: boolean; options?: string[] };
};

function apiFields(fields: readonly SectionFieldDefinition[] | undefined): ApiField[] {
  return (fields ?? []).map((field) => ({
    handle: field.handle,
    label: field.label,
    component_key: field.type,
    config: {
      ...(field.required ? { required: true } : {}),
      ...(field.type === "select" ? { options: [...field.options] } : {}),
    },
  }));
}

/** The body of `PUT /sites/{id}/section-types`: every section type the site's code defines. */
export type SectionTypesPayload = {
  sections: {
    handle: string;
    name: string;
    fields: ApiField[];
    blocks: { handle: string; name: string; fields: ApiField[] }[];
  }[];
};

/** Turns section definitions (already checked) into what the CMS takes. */
export function sectionTypesPayload(definitions: readonly SectionDefinition[]): SectionTypesPayload {
  return {
    sections: definitions.map((definition) => ({
      handle: definition.handle,
      name: definition.name,
      fields: apiFields(definition.fields),
      blocks: Object.entries(definition.blocks ?? {}).map(([handle, block]) => ({
        handle,
        name: block.name,
        fields: apiFields(block.fields),
      })),
    })),
  };
}
