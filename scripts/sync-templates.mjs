// Keeps the starter sites that `ace-kit create` copies (templates/) in step with the example sites they come from.
// The example sites live next to this folder in the CMS Ace project, so this is run by hand, not in CI:
//
//   node scripts/sync-templates.mjs           copy the example sites into templates/
//   node scripts/sync-templates.mjs --check   fail if templates/ has drifted from the example sites
//
// A starter is a plain copy of its example site minus what belongs to the example alone (dependencies, build output,
// settings, the seed script, the README). `.gitignore` is stored as `_gitignore`: npm never publishes a file called
// .gitignore, and `create` renames it back.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatesRoot = join(kitRoot, "templates");

/** Starter name -> the example site it is copied from. */
const sources = {
  astro: resolve(kitRoot, "../example-astro-site"),
  "react-router": resolve(kitRoot, "../example-react-router-site"),
};

/** Files and folders (by name, anywhere) that are never copied. */
const skippedNames = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".astro",
  ".react-router",
  "package-lock.json",
  "README.md",
  "seed-cms.mjs",
  ".DS_Store",
]);
const isSkipped = (name) => skippedNames.has(name) || name.startsWith(".env") || name.endsWith(".tgz");

const storedName = (name) => (name === ".gitignore" ? "_gitignore" : name);

/** Every file to copy, as paths relative to the example site's folder. */
async function listFiles(folder, base = folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (isSkipped(entry.name)) continue;
    // A link (the example's CLAUDE.md points at AGENTS.md) would be copied pointing at a path on this machine, and npm
    // doesn't publish links at all, so a starter has none.
    if (entry.isSymbolicLink()) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else files.push(relative(base, path));
  }
  // A scripts folder left empty by the skips would be an empty folder in the starter: only files are listed, so it is not.
  return files.sort();
}

/**
 * The body `PUT /sites/{id}/section-types` takes for a starter's sections, worked out from its *.schema.ts files (which
 * need the kit installed to be loaded, so this uses the example site's copy). `create` sends it to the CMS, because the
 * new folder has no node_modules yet. Null for a starter with no sections.
 */
async function sectionTypesOf(source) {
  // Astro keeps code in src, React Router in app.
  const files = [];
  for (const folder of ["src", "app"]) {
    for (const file of await listFiles(join(source, folder)).catch(() => []))
      if (/\.schema\.(ts|mts|js|mjs)$/.test(file)) files.push(join(source, folder, file));
  }
  if (files.length === 0) return null;
  const { sectionTypesPayload } = await import(
    pathToFileURL(join(source, "node_modules/@sandboxsonny/ace-kit/dist/index.js")).href
  );
  const definitions = [];
  for (const file of files) definitions.push((await import(pathToFileURL(file).href)).default);
  return `${JSON.stringify(sectionTypesPayload(definitions), null, 2)}\n`;
}

const sectionTypesFile = (name) => join(templatesRoot, `${name}.section-types.json`);

const targetPath = (name, file) => join(templatesRoot, name, dirname(file), storedName(file.split("/").pop()));

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function sync() {
  for (const [name, source] of Object.entries(sources)) {
    if (!(await exists(source))) throw new Error(`${source} does not exist: run this inside the CMS Ace project.`);
    await rm(join(templatesRoot, name), { recursive: true, force: true });
    for (const file of await listFiles(source)) {
      const target = targetPath(name, file);
      await mkdir(dirname(target), { recursive: true });
      await cp(join(source, file), target);
    }
    const sectionTypes = await sectionTypesOf(source);
    if (sectionTypes === null) await rm(sectionTypesFile(name), { force: true });
    else await writeFile(sectionTypesFile(name), sectionTypes);
    console.log(`Copied ${name} from ${source}.`);
  }
}

async function check() {
  const problems = [];
  for (const [name, source] of Object.entries(sources)) {
    if (!(await exists(source))) {
      console.log(`Skipping the ${name} starter check: ${source} is not here.`);
      continue;
    }
    const wanted = await listFiles(source);
    for (const file of wanted) {
      const target = targetPath(name, file);
      if (!(await exists(target))) {
        problems.push(`templates/${name}: ${file} is missing`);
        continue;
      }
      const [original, copy] = await Promise.all([readFile(join(source, file)), readFile(target)]);
      if (!original.equals(copy)) problems.push(`templates/${name}: ${file} differs from the example site`);
    }
    const sectionTypes = await sectionTypesOf(source);
    const recorded = await readFile(sectionTypesFile(name), "utf8").catch(() => null);
    if (sectionTypes !== recorded) problems.push(`templates/${name}.section-types.json is out of date`);
    const kept = new Set(wanted.map((file) => relative(join(templatesRoot, name), targetPath(name, file))));
    for (const file of await listFiles(join(templatesRoot, name)).catch(() => [])) {
      if (!kept.has(file)) problems.push(`templates/${name}: ${file} is not in the example site`);
    }
  }
  if (problems.length > 0) {
    console.error(`The starter sites have drifted:\n- ${problems.join("\n- ")}\nRun: node scripts/sync-templates.mjs`);
    process.exit(1);
  }
  console.log("The starter sites match the example sites.");
}

if (process.argv.includes("--check")) await check();
else await sync();
