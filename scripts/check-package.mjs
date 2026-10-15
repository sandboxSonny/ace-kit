// Checks what would be published, before it is: every file the package points at exists, the command line tool
// can run, and nothing that shouldn't ship (sources, tests, config) does.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const problems = [];

const targets = new Set();
const collect = (value) => {
  if (typeof value === "string") targets.add(value);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
};
collect(manifest.exports);
collect(manifest.bin);

for (const target of targets) {
  if (target.includes("*")) continue; // a pattern, checked through the packed file list below
  if (!existsSync(target))
    problems.push(`package.json points at ${target}, which does not exist (did you run the build?)`);
}

const [{ files }] = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8" }),
);
const packed = files.map((file) => file.path);

for (const required of [
  "package.json",
  "README.md",
  "CHANGELOG.md",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/react.d.ts",
  "dist/astro.d.ts",
  "dist/astro-integration.js",
  "dist/astro-integration.d.ts",
  "dist/astro-middleware.js",
  "dist/react-router.js",
  "dist/react-router.d.ts",
  "dist/react-router-server.js",
  "dist/react-router-server.d.ts",
  "dist/vite.js",
  "dist/vite.d.ts",
  "astro/AceMenu.astro",
  "astro/AceTextArea.astro",
  "astro/AceNotice.astro",
  "dist/cli.js",
  "dist/preview-script.js",
  "astro/AceImage.astro",
  "astro/AceLink.astro",
  "astro/AceSections.astro",
  "astro/AceRichText.astro",
  "astro/AcePreviewRefresh.astro",
  "templates/astro/package.json",
  "templates/astro/_gitignore",
  "templates/astro.section-types.json",
  "templates/react-router.section-types.json",
  "templates/astro/astro.config.mjs",
  "templates/react-router/package.json",
  "templates/react-router/_gitignore",
  "templates/react-router/vite.config.ts",
]) {
  if (!packed.includes(required)) problems.push(`${required} is missing from the package`);
}
for (const file of packed) {
  if (/^(src|stories|scripts|\.storybook|\.changeset|\.github)\//.test(file))
    problems.push(`${file} should not be published`);
  if (!file.startsWith("templates/") && /\.(test|stories)\./.test(file))
    problems.push(`${file} should not be published`);
}

const cli = readFileSync("dist/cli.js", "utf8");
if (!cli.startsWith("#!/usr/bin/env node"))
  problems.push("dist/cli.js has no #! line, so the ace-kit command would not run");

if (manifest.private) problems.push("package.json says private: true, so it cannot be published");
if (!manifest.name.startsWith("@")) problems.push("the package should have a scoped name (@owner/name)");
if (manifest.publishConfig?.access !== "public")
  problems.push("publishConfig.access should be public, or a scoped package is published as private");
if (manifest.publishConfig?.registry)
  problems.push("publishConfig.registry is set, so it would not be published to npm");
if (manifest.license !== "MIT") problems.push("package.json should say license MIT, to match LICENSE");
if (!manifest.repository?.url || !manifest.homepage || !manifest.bugs?.url)
  problems.push("package.json needs repository, homepage and bugs, which npm shows on the package page");

const licence = readFileSync("LICENSE", "utf8");
if (!licence.startsWith("MIT License")) problems.push("LICENSE is not the MIT licence");
for (const file of [".npmrc", ".env"]) {
  if (existsSync(file)) problems.push(`${file} is in the repository folder: it could carry a registry or a secret`);
}

if (problems.length > 0) {
  console.error(`Package check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Package check passed: ${packed.length} files, ${targets.size} entry points.`);
