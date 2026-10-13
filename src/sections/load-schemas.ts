import { relative } from "node:path";

import type { SectionDefinition } from "./define-section";
import { checkSectionDefinition } from "./payload";

/** What loading the schema files gave: the definitions, or what stops them being used. */
export type LoadedSchemas = {
  definitions: { file: string; definition: SectionDefinition }[];
  /** Reasons the files can't be used, each naming its file. If there are any, nothing should be synced. */
  problems: string[];
};

/**
 * Loads each schema file (with `importModule`) and checks what it exports. All problems are collected, not just the
 * first. The caller must not sync anything when there are problems: the CMS treats the list it is sent as the whole
 * list, so syncing the files that did load would retire the sections of the ones that didn't.
 */
export async function loadSchemas(
  files: readonly string[],
  root: string,
  importModule: (path: string) => Promise<unknown>,
): Promise<LoadedSchemas> {
  const definitions: LoadedSchemas["definitions"] = [];
  const problems: string[] = [];
  const handleToFile = new Map<string, string>();

  for (const file of files) {
    const name = relative(root, file);
    let exported: unknown;
    try {
      const module = (await importModule(file)) as { default?: unknown };
      exported = module.default;
    } catch (error) {
      problems.push(`${name}: could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const fileProblems = checkSectionDefinition(exported, name);
    if (fileProblems.length > 0) {
      problems.push(...fileProblems);
      continue;
    }
    const definition = exported as SectionDefinition;
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
