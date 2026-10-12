import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import ace from "./plugin";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ACE_TEST_ONE;
  delete process.env.ACE_TEST_TWO;
  delete process.env.OTHER_TEST_VALUE;
});

type PluginResult = { resolve: { dedupe: string[] }; test: { server: { deps: { inline: string[] } } } };
type ConfigHook = (config: { root?: string }, environment: { mode: string; command: string }) => PluginResult;

/** Runs the plugin's config hook as Vite would, for a project in `folder` (found from the cwd, or from `root`). */
function runIn(folder: string, mode = "development", root?: string) {
  vi.spyOn(process, "cwd").mockReturnValue(folder);
  return (ace().config as ConfigHook)(root ? { root } : {}, { mode, command: "serve" });
}

describe("the Vite plugin", () => {
  it("makes the site use one copy of React and React Router", () => {
    const result = runIn(mkdtempSync(join(tmpdir(), "ace-kit-")));
    expect(result.resolve.dedupe).toEqual(["react", "react-dom", "react-router"]);
  });

  it("has Vitest run the kit itself, so a site's tests and the kit share one React Router", () => {
    const result = runIn(mkdtempSync(join(tmpdir(), "ace-kit-")));
    expect(result.test.server.deps.inline).toEqual(["@sandboxsonny/ace-kit"]);
  });

  it("reads .env from the project's root when Vite says where that is, not from wherever it was started", () => {
    const project = mkdtempSync(join(tmpdir(), "ace-kit-"));
    writeFileSync(join(project, ".env"), "ACE_TEST_ONE=from-the-root\n");
    runIn(mkdtempSync(join(tmpdir(), "ace-kit-elsewhere-")), "development", project);
    expect(process.env.ACE_TEST_ONE).toBe("from-the-root");
  });

  it("puts the ACE_ variables from .env files into process.env, and nothing else", () => {
    const folder = mkdtempSync(join(tmpdir(), "ace-kit-"));
    writeFileSync(join(folder, ".env"), "ACE_TEST_ONE=from-file\nOTHER_TEST_VALUE=private\n");
    runIn(folder);
    expect(process.env.ACE_TEST_ONE).toBe("from-file");
    expect(process.env.OTHER_TEST_VALUE).toBeUndefined();
  });

  it("never replaces a variable that is already set", () => {
    const folder = mkdtempSync(join(tmpdir(), "ace-kit-"));
    writeFileSync(join(folder, ".env"), "ACE_TEST_ONE=from-file\n");
    process.env.ACE_TEST_ONE = "from-host";
    runIn(folder);
    expect(process.env.ACE_TEST_ONE).toBe("from-host");
  });

  it("reads the file for the mode too, which wins over .env", () => {
    const folder = mkdtempSync(join(tmpdir(), "ace-kit-"));
    writeFileSync(join(folder, ".env"), "ACE_TEST_ONE=base\nACE_TEST_TWO=base\n");
    writeFileSync(join(folder, ".env.production"), "ACE_TEST_ONE=production\n");
    runIn(folder, "production");
    expect([process.env.ACE_TEST_ONE, process.env.ACE_TEST_TWO]).toEqual(["production", "base"]);
  });

  it("copes with no .env file at all", () => {
    runIn(mkdtempSync(join(tmpdir(), "ace-kit-")));
    expect(process.env.ACE_TEST_ONE).toBeUndefined();
  });
});
