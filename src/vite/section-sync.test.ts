import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import sectionSync, { startSectionSync } from "./section-sync";
import type { SyncRun } from "./section-sync";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ace-kit-watch-"));
  delete process.env.VITEST;
});
afterEach(async () => {
  vi.useRealTimers();
  process.env.VITEST = "true";
  await rm(root, { recursive: true, force: true });
});

/** The parts of a Vite dev server that the sync uses. */
function fakeServer(mode = "development") {
  const watcher = new EventEmitter();
  const httpServer = Object.assign(new EventEmitter(), { listening: false });
  const info = vi.fn();
  const warn = vi.fn();
  const server = { config: { root, mode, logger: { info, warn } }, watcher, httpServer } as unknown as ViteDevServer;
  return { server, watcher, httpServer, info, warn };
}

const ok = (...output: string[]): SyncRun => ({ output, errors: [], failed: false });

async function withSchema() {
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "Hero.schema.ts"), "");
}

/** Lets pending promises (the file search) settle without moving the clock. */
const settle = async () => {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
};

describe("syncing section types while the dev server runs", () => {
  it("syncs once when the server starts listening, if the site has schema files, and logs what it printed", async () => {
    vi.useFakeTimers();
    await withSchema();
    const { server, httpServer, info } = fakeServer();
    const runSync = vi.fn(async () => ok("Synced 1 section type (hero) to localhost (http://localhost:8080)."));
    startSectionSync(server, { runSync, debounceMilliseconds: 100 });

    expect(runSync).not.toHaveBeenCalled();
    httpServer.emit("listening");
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(runSync).toHaveBeenCalledExactlyOnceWith(root);
    expect(info).toHaveBeenCalledWith("[ace-kit] Synced 1 section type (hero) to localhost (http://localhost:8080).", {
      timestamp: true,
    });
  });

  it("does not start the program for a site with no schema files", async () => {
    const { server, httpServer } = fakeServer();
    const runSync = vi.fn(async () => ok());
    startSectionSync(server, { runSync, debounceMilliseconds: 10 });
    httpServer.emit("listening");
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(runSync).not.toHaveBeenCalled();
  });

  it("syncs again when a schema file is added, changed or removed, and not for any other file", async () => {
    vi.useFakeTimers();
    const { server, watcher } = fakeServer();
    const runSync = vi.fn(async () => ok("done"));
    startSectionSync(server, { runSync, debounceMilliseconds: 100 });

    for (const path of [
      "/site/src/Hero.astro",
      "/site/src/Hero.ts",
      "/site/src/schema.ts",
      "/site/src/Hero.schema.d.ts",
      "/site/package.json",
    ])
      watcher.emit("change", path);
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).not.toHaveBeenCalled();

    for (const event of ["add", "change", "unlink"]) {
      runSync.mockClear();
      watcher.emit(event, "/site/src/components/Faq.schema.ts");
      await vi.advanceTimersByTimeAsync(500);
      expect(runSync, event).toHaveBeenCalledTimes(1);
    }
  });

  it("syncs at start for a site that has only form files", async () => {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "contact.form.ts"), "");
    const { server, httpServer } = fakeServer();
    const runSync = vi.fn(async () => ok("done"));
    startSectionSync(server, { runSync, debounceMilliseconds: 10 });
    httpServer.emit("listening");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("syncs when a form file changes, and not for its type declaration", async () => {
    vi.useFakeTimers();
    const { server, watcher } = fakeServer();
    const runSync = vi.fn(async () => ok("done"));
    startSectionSync(server, { runSync, debounceMilliseconds: 100 });
    watcher.emit("change", "/site/src/forms/quote.form.d.ts");
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).not.toHaveBeenCalled();
    watcher.emit("change", "/site/src/forms/quote.form.ts");
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("makes a burst of saves one sync", async () => {
    vi.useFakeTimers();
    const { server, watcher } = fakeServer();
    const runSync = vi.fn(async () => ok("done"));
    startSectionSync(server, { runSync, debounceMilliseconds: 100 });
    for (let save = 0; save < 6; save++) {
      watcher.emit("change", `/site/src/S${save}.schema.ts`);
      await vi.advanceTimersByTimeAsync(40);
    }
    expect(runSync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("never runs two syncs at once: a change during one is synced afterwards, once", async () => {
    vi.useFakeTimers();
    const { server, watcher } = fakeServer();
    let active = 0;
    let peak = 0;
    const finishers: (() => void)[] = [];
    const runSync = vi.fn(
      () =>
        new Promise<SyncRun>((resolve) => {
          active += 1;
          peak = Math.max(peak, active);
          finishers.push(() => {
            active -= 1;
            resolve(ok("done"));
          });
        }),
    );
    startSectionSync(server, { runSync, debounceMilliseconds: 50 });

    watcher.emit("change", "/site/src/A.schema.ts");
    await vi.advanceTimersByTimeAsync(60);
    expect(runSync).toHaveBeenCalledTimes(1);

    // Two more saves while the first is still running.
    watcher.emit("change", "/site/src/B.schema.ts");
    await vi.advanceTimersByTimeAsync(60);
    watcher.emit("change", "/site/src/C.schema.ts");
    await vi.advanceTimersByTimeAsync(60);
    expect(runSync).toHaveBeenCalledTimes(1);

    finishers[0]();
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    expect(runSync).toHaveBeenCalledTimes(2);
    finishers[1]();
    await settle();
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).toHaveBeenCalledTimes(2);
    expect(peak).toBe(1);
  });

  it("logs what went wrong as warnings, and keeps going", async () => {
    vi.useFakeTimers();
    const { server, watcher, warn, info } = fakeServer();
    const runs: (SyncRun | Error)[] = [
      { output: [], errors: ["src/Hero.schema.ts: could not be loaded: boom", "Nothing was synced."], failed: true },
      { output: [], errors: [], failed: true },
      new Error("spawn failed"),
      ok("Synced 1 section type (hero) to localhost (http://localhost:8080)."),
    ];
    const runSync = vi.fn(async () => {
      const next = runs.shift()!;
      if (next instanceof Error) throw next;
      return next;
    });
    startSectionSync(server, { runSync, debounceMilliseconds: 10 });
    for (let index = 0; index < 4; index++) {
      watcher.emit("change", "/site/src/Hero.schema.ts");
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(warn).toHaveBeenCalledWith("[ace-kit] src/Hero.schema.ts: could not be loaded: boom", { timestamp: true });
    expect(warn).toHaveBeenCalledWith("[ace-kit] Nothing was synced.", { timestamp: true });
    expect(warn).toHaveBeenCalledWith("[ace-kit] The section sync failed.", { timestamp: true });
    expect(warn).toHaveBeenCalledWith("[ace-kit] The section sync failed: spawn failed", { timestamp: true });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Synced 1 section type"), { timestamp: true });
    expect(runSync).toHaveBeenCalledTimes(4);
  });

  it("stops when the server closes", async () => {
    vi.useFakeTimers();
    const { server, watcher, httpServer } = fakeServer();
    const runSync = vi.fn(async () => ok("done"));
    startSectionSync(server, { runSync, debounceMilliseconds: 10 });
    watcher.emit("change", "/site/src/A.schema.ts");
    httpServer.emit("close");
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).not.toHaveBeenCalled();
    watcher.emit("change", "/site/src/A.schema.ts");
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).not.toHaveBeenCalled();
    expect(watcher.listenerCount("change")).toBe(0);
  });

  it("does not start another sync after the server closes, even if a change came in while one was running", async () => {
    vi.useFakeTimers();
    const { server, watcher, httpServer } = fakeServer();
    const finishers: (() => void)[] = [];
    const runSync = vi.fn(() => new Promise<SyncRun>((resolve) => finishers.push(() => resolve(ok("done")))));
    startSectionSync(server, { runSync, debounceMilliseconds: 10 });
    watcher.emit("change", "/site/src/A.schema.ts");
    await vi.advanceTimersByTimeAsync(50);
    watcher.emit("change", "/site/src/B.schema.ts");
    await vi.advanceTimersByTimeAsync(50);
    expect(runSync).toHaveBeenCalledTimes(1);

    httpServer.emit("close");
    finishers[0]();
    await settle();
    await vi.advanceTimersByTimeAsync(500);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("does nothing in a site's own tests", async () => {
    vi.useFakeTimers();
    await withSchema();
    for (const mode of ["test"]) {
      const { server, watcher, httpServer } = fakeServer(mode);
      const runSync = vi.fn(async () => ok("done"));
      startSectionSync(server, { runSync });
      httpServer.emit("listening");
      watcher.emit("change", "/site/src/Hero.schema.ts");
      await vi.advanceTimersByTimeAsync(1000);
      expect(runSync).not.toHaveBeenCalled();
      expect(watcher.listenerCount("change")).toBe(0);
    }
    process.env.VITEST = "true";
    const { server, watcher } = fakeServer();
    const runSync = vi.fn(async () => ok("done"));
    startSectionSync(server, { runSync });
    watcher.emit("change", "/site/src/Hero.schema.ts");
    await vi.advanceTimersByTimeAsync(1000);
    expect(runSync).not.toHaveBeenCalled();
  });
});

describe("the sectionSync plugin", () => {
  it("is only for the dev server, and starts the sync there", () => {
    const plugin = sectionSync();
    expect(plugin.name).toBe("ace-kit:section-sync");
    expect(plugin.apply).toBe("serve");
    expect(typeof plugin.configureServer).toBe("function");
  });
});
