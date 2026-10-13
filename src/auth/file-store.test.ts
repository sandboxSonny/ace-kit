import { mkdtemp, readFile, readdir, rm, stat, writeFile, chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileStore, defaultLoginFile } from "./file-store";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "ace-kit-test-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const login = { token: "secret-token-one", email: "sam@example.com", expiresAt: "2026-12-01T00:00:00Z" };
const permissions = async (path: string) => (await stat(path)).mode & 0o777;
const onWindows = process.platform === "win32";

describe("the file store", () => {
  it("keeps a login and gives it back, and forgets it", async () => {
    const store = createFileStore(join(folder, "ace-kit", "credentials.json"));
    expect(await store.read("http://localhost:8080")).toBeNull();
    await store.write("http://localhost:8080", login);
    expect(await store.read("http://localhost:8080")).toEqual(login);
    await store.remove("http://localhost:8080");
    expect(await store.read("http://localhost:8080")).toBeNull();
  });

  it("keeps one login per API, and finds it however the address is written", async () => {
    const store = createFileStore(join(folder, "credentials.json"));
    await store.write("http://localhost:8080", login);
    await store.write("https://api.example.com/", { ...login, token: "secret-token-two" });
    expect((await store.read("HTTP://localhost:8080/"))?.token).toBe("secret-token-one");
    expect((await store.read("https://api.example.com"))?.token).toBe("secret-token-two");
    await store.remove("http://localhost:8080");
    expect((await store.read("https://api.example.com"))?.token).toBe("secret-token-two");
  });

  it.skipIf(onWindows)("makes the file readable by its owner only, and its folder too", async () => {
    const path = join(folder, "ace-kit", "credentials.json");
    await createFileStore(path).write("http://localhost:8080", login);
    expect((await permissions(path)).toString(8)).toBe("600");
    expect((await permissions(join(folder, "ace-kit"))).toString(8)).toBe("700");
  });

  it.skipIf(onWindows)("tightens a file that was readable by others when it writes again", async () => {
    const path = join(folder, "credentials.json");
    await writeFile(path, "{}", { mode: 0o644 });
    await chmod(path, 0o644);
    await createFileStore(path).write("http://localhost:8080", login);
    expect((await permissions(path)).toString(8)).toBe("600");
  });

  it("leaves no half-written file behind", async () => {
    await createFileStore(join(folder, "credentials.json")).write("http://localhost:8080", login);
    expect(await readdir(folder)).toEqual(["credentials.json"]);
  });

  it("copes with a file that is damaged, empty or not an object, as if there were no logins", async () => {
    const path = join(folder, "credentials.json");
    const store = createFileStore(path);
    for (const content of [
      "",
      "not json",
      "[1,2]",
      "null",
      '{"http://localhost:8080": "text"}',
      '{"http://localhost:8080": {"token": 5}}',
    ]) {
      await writeFile(path, content);
      expect(await store.read("http://localhost:8080"), content).toBeNull();
    }
    // And it can be written over.
    await store.write("http://localhost:8080", login);
    expect(await store.read("http://localhost:8080")).toEqual(login);
  });

  it("keeps the other logins when one is damaged", async () => {
    const path = join(folder, "credentials.json");
    await writeFile(path, JSON.stringify({ "http://a.test": login, "http://b.test": { token: 5 } }));
    const store = createFileStore(path);
    expect(await store.read("http://a.test")).toEqual(login);
    await store.write("http://c.test", login);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ "http://a.test": login, "http://c.test": login });
  });

  it("says where the logins are kept", () => {
    expect(createFileStore("/some/where.json").description).toBe("/some/where.json");
  });

  it("makes its folder when it isn't there yet", async () => {
    const path = join(folder, "a", "b", "credentials.json");
    await mkdir(join(folder, "a"));
    await createFileStore(path).write("http://localhost:8080", login);
    expect(await readFile(path, "utf8")).toContain("secret-token-one");
  });
});

describe("defaultLoginFile", () => {
  it("is in the config folder, as other command line tools do", () => {
    expect(defaultLoginFile({ XDG_CONFIG_HOME: "/home/sam/.cfg" }, "linux")).toBe(
      "/home/sam/.cfg/ace-kit/credentials.json",
    );
    expect(defaultLoginFile({}, "linux")).toMatch(/\.config[\\/]ace-kit[\\/]credentials\.json$/);
    expect(defaultLoginFile({ APPDATA: "C:\\Users\\sam\\AppData\\Roaming" }, "win32")).toMatch(
      /AppData.Roaming.ace-kit.credentials\.json$/,
    );
    expect(defaultLoginFile({}, "win32")).toMatch(/\.config/);
  });
});
