import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

/** Files that describe a section: Faq.schema.ts, hero.schema.js and so on. */
export const schemaFilePattern = /\.schema\.(?:ts|mts|js|mjs)$/;

/** Folders that never hold a site's own schema files. */
const skippedFolders = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".astro",
  ".react-router",
  ".output",
  "coverage",
]);

/**
 * Finds the schema files under a folder of the site (its `src` by default), in a steady order. A folder that isn't
 * there has none.
 */
export async function findSchemaFiles(root: string, folder = "src"): Promise<string[]> {
  const start = join(root, folder);
  const found: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skippedFolders.has(entry.name)) await walk(path);
      } else if (entry.isFile() && schemaFilePattern.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        found.push(path);
      }
    }
  }

  await walk(start);
  // Compared plainly, not by locale, so the order is the same on every machine.
  return found.sort((first, second) => {
    const [firstName, secondName] = [relative(root, first), relative(root, second)];
    return firstName < secondName ? -1 : firstName > secondName ? 1 : 0;
  });
}
