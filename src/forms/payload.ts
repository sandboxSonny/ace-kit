import type { FormDefinition, FormFieldType } from "./define-form";

const handlePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const maximumHandleLength = 64;
const maximumNameLength = 100;
const maximumFields = 30;

const fieldTypes: readonly FormFieldType[] = ["text", "email", "textarea", "select", "checkbox"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHandle = (value: unknown): value is string =>
  typeof value === "string" && value.length <= maximumHandleLength && handlePattern.test(value);

const handleRule = 'lowercase letters, numbers and hyphens (such as "contact")';

/**
 * Checks a form definition and returns what is wrong with it, written for the person who wrote it (an empty list
 * means it is fine). The CMS checks everything again; this is so the mistake is reported against the file, at once.
 */
export function checkFormDefinition(definition: unknown, where = "this form"): string[] {
  const problems: string[] = [];
  if (!isObject(definition)) return [`${where}: the default export must be the result of defineForm({ ... }).`];
  if (!isHandle(definition.handle)) problems.push(`${where}: needs a handle of ${handleRule}.`);
  if (
    typeof definition.name !== "string" ||
    definition.name.trim() === "" ||
    definition.name.length > maximumNameLength
  ) {
    problems.push(`${where}: needs a name.`);
  }
  const { fields } = definition;
  if (!Array.isArray(fields) || fields.length === 0) {
    problems.push(`${where}: needs a list of fields.`);
    return problems;
  }
  if (fields.length > maximumFields) problems.push(`${where}: a form can have up to ${maximumFields} fields.`);
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
    if (typeof field.type !== "string" || !fieldTypes.includes(field.type as FormFieldType)) {
      const given = typeof field.type === "string" ? ` "${field.type}"` : "";
      problems.push(`${where}: ${name} has a type${given} that isn't one of ${fieldTypes.join(", ")}.`);
    } else if (field.type === "select") {
      const { options } = field;
      if (
        !Array.isArray(options) ||
        options.length === 0 ||
        options.some((option) => typeof option !== "string" || option.trim() === "")
      ) {
        problems.push(`${where}: ${name} is a select, so it needs options: a list of the choices, as text.`);
      }
    }
    if (field.required !== undefined && typeof field.required !== "boolean") {
      problems.push(`${where}: ${name} has a required that isn't true or false.`);
    }
  });
  return problems;
}

/** The body of `PUT /sites/{id}/forms`: every form the site's code defines. */
export type FormsPayload = {
  forms: {
    handle: string;
    name: string;
    fields: { handle: string; label: string; kind: FormFieldType; required: boolean; options?: string[] }[];
  }[];
};

/** Turns form definitions (already checked) into what the CMS takes. */
export function formsPayload(definitions: readonly FormDefinition[]): FormsPayload {
  return {
    forms: definitions.map((definition) => ({
      handle: definition.handle,
      name: definition.name,
      fields: definition.fields.map((field) => ({
        handle: field.handle,
        label: field.label,
        kind: field.type,
        required: field.required === true,
        ...(field.type === "select" ? { options: [...field.options] } : {}),
      })),
    })),
  };
}
