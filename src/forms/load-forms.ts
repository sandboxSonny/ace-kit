import { relative } from "node:path";

import type { FormDefinition } from "./define-form";
import { checkFormDefinition } from "./payload";

/** What loading the form files gave: the definitions, or what stops them being used. */
export type LoadedForms = {
  definitions: { file: string; definition: FormDefinition }[];
  /** Reasons the files can't be used, each naming its file. If there are any, nothing should be synced. */
  problems: string[];
};

/**
 * Loads each form file (with `importModule`) and checks what it exports. All problems are collected. The caller must
 * not sync anything when there are problems: the CMS treats the list as the whole list, so syncing the forms that did
 * load would retire the forms of the files that didn't.
 */
export async function loadForms(
  files: readonly string[],
  root: string,
  importModule: (path: string) => Promise<unknown>,
): Promise<LoadedForms> {
  const definitions: LoadedForms["definitions"] = [];
  const problems: string[] = [];
  const handleToFile = new Map<string, string>();

  for (const file of files) {
    const name = relative(root, file);
    let exported: unknown;
    try {
      exported = ((await importModule(file)) as { default?: unknown }).default;
    } catch (error) {
      problems.push(`${name}: could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const fileProblems = checkFormDefinition(exported, name);
    if (fileProblems.length > 0) {
      problems.push(...fileProblems);
      continue;
    }
    const definition = exported as FormDefinition;
    const earlier = handleToFile.get(definition.handle);
    if (earlier) {
      problems.push(`${name}: the handle "${definition.handle}" is already used by ${earlier}.`);
      continue;
    }
    handleToFile.set(definition.handle, name);
    definitions.push({ file, definition });
  }
  return { definitions, problems };
}
