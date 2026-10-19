import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Plugin, ViteDevServer } from "vite";

import { findFormFiles, findSchemaFiles, formFilePattern, schemaFilePattern } from "../sections/find-schemas";

/** What running the sync came to: the lines it printed, and whether it failed. */
export type SyncRun = { output: string[]; errors: string[]; failed: boolean };

export type SectionSyncOptions = {
  /** Runs `ace-kit sync --automatic` in the site's folder. Replaced in tests. */
  runSync?: (root: string) => Promise<SyncRun>;
  /** How long after the last change to wait before syncing, so saving several files is one sync. */
  debounceMilliseconds?: number;
};

/**
 * Node 22.18 and newer run TypeScript as it is; older 22.x need to be told to. Schema files are .ts, and the sync
 * runs them in a program of its own, which is more reliable than loading them through the dev server (whose way of
 * running a module has changed between Vite versions).
 */
function nodeFlags(version: string): string[] {
  const [major, minor] = version.split(".").map(Number);
  return major === 22 && minor < 18 ? ["--experimental-strip-types", "--no-warnings"] : [];
}

function runSyncProgram(root: string): Promise<SyncRun> {
  return new Promise((resolve) => {
    const program = fileURLToPath(new URL("./cli.js", import.meta.url));
    const child = spawn(process.execPath, [...nodeFlags(process.versions.node), program, "sync", "--automatic"], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let standardOutput = "";
    let standardError = "";
    child.stdout.on("data", (chunk: Buffer) => (standardOutput += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (standardError += chunk.toString("utf8")));
    const lines = (text: string) =>
      text
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line !== "");
    child.on("error", (error) =>
      resolve({ output: [], errors: [`Could not run ace-kit sync: ${error.message}`], failed: true }),
    );
    child.on("close", (exitCode) =>
      resolve({ output: lines(standardOutput), errors: lines(standardError), failed: exitCode !== 0 }),
    );
  });
}

/**
 * Syncs a site's section types and forms while its dev server runs: once when it starts, and again whenever a
 * `*.schema.ts` or `*.form.ts` file is added, changed or removed. Each sync runs `ace-kit sync --automatic` (see the command for what it does and
 * doesn't do), serialised, and what it prints goes to the dev server's log. A site with no schema or form files is never
 * bothered. Returns a function that stops it.
 */
export function startSectionSync(server: ViteDevServer, options: SectionSyncOptions = {}): () => void {
  // A site's own tests start a Vite server too (Vitest does), and must not reach out to a CMS.
  if (server.config.mode === "test" || process.env.VITEST) return () => undefined;

  const root = server.config.root;
  const logger = server.config.logger;
  const runSync = options.runSync ?? runSyncProgram;
  const debounceMilliseconds = options.debounceMilliseconds ?? 250;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let again = false;
  let stopped = false;

  async function run(): Promise<void> {
    if (stopped) return;
    if (running) {
      // A change arrived while syncing: sync once more afterwards, with whatever the files are by then.
      again = true;
      return;
    }
    running = true;
    try {
      const result = await runSync(root);
      for (const line of result.output) logger.info(`[ace-kit] ${line}`, { timestamp: true });
      for (const line of result.errors) logger.warn(`[ace-kit] ${line}`, { timestamp: true });
      if (result.failed && result.errors.length === 0)
        logger.warn("[ace-kit] The section sync failed.", { timestamp: true });
    } catch (error) {
      logger.warn(`[ace-kit] The section sync failed: ${error instanceof Error ? error.message : String(error)}`, {
        timestamp: true,
      });
    } finally {
      running = false;
    }
    if (again && !stopped) {
      again = false;
      await run();
    }
  }

  function schedule(): void {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void run(), debounceMilliseconds);
  }

  const onFileEvent = (path: string) => {
    if ((schemaFilePattern.test(path) || formFilePattern.test(path)) && !path.endsWith(".d.ts")) schedule();
  };
  for (const event of ["add", "change", "unlink"] as const) server.watcher.on(event, onFileEvent);

  // At start, only a site that has schema files is synced; the program would say nothing for one that has none, but
  // starting it takes a moment the dev server doesn't need to spend.
  const start = () => {
    void Promise.all([findSchemaFiles(root), findFormFiles(root)]).then(([schemaFiles, formFiles]) => {
      if (schemaFiles.length + formFiles.length > 0) schedule();
    });
  };
  if (server.httpServer && !server.httpServer.listening) server.httpServer.once("listening", start);
  else start();

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    for (const event of ["add", "change", "unlink"] as const) server.watcher.off(event, onFileEvent);
  };
  server.httpServer?.once("close", stop);
  return stop;
}

/**
 * A Vite plugin that syncs a site's section types to the CMS while the dev server runs. The Astro integration adds
 * it; on React Router it is part of the `ace()` plugin.
 */
export default function sectionSync(options?: SectionSyncOptions): Plugin {
  return {
    name: "ace-kit:section-sync",
    apply: "serve",
    configureServer(server) {
      startSectionSync(server, options);
    },
  };
}
