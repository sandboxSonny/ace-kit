// Checked before the rest of the tool is loaded: older versions of Node lack things it needs (Node 16 has no `fetch`).
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    `ace-kit needs Node 22.12 or newer, and this is Node ${process.versions.node}. ` +
      "If you use a version manager (mise, nvm, fnm), check which version it picks in this folder.",
  );
  process.exit(1);
}

try {
  const { createRealEnvironment } = await import("./environment");
  const { runCli } = await import("./main");
  const environment = await createRealEnvironment();
  process.exit(await runCli(process.argv.slice(2), environment));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export {};
