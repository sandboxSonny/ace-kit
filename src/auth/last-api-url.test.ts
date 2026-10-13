import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLastApiUrl, defaultLastApiUrlFile } from "./last-api-url";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "ace-kit-last-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("the remembered API address", () => {
  it("keeps the last address, written one way", async () => {
    const remembered = createLastApiUrl(join(folder, "ace-kit", "last-api-url"));
    expect(await remembered.read()).toBeNull();
    await remembered.write("HTTP://Localhost:8080/");
    expect(await remembered.read()).toBe("http://localhost:8080");
    await remembered.write("https://api.example.com");
    expect(await remembered.read()).toBe("https://api.example.com");
  });

  it.skipIf(process.platform === "win32")("is private to the person, like the logins beside it", async () => {
    const path = join(folder, "last-api-url");
    await createLastApiUrl(path).write("http://localhost:8080");
    expect(((await stat(path)).mode & 0o777).toString(8)).toBe("600");
  });

  it("reads a file that was damaged or edited into something that isn't a web address as nothing", async () => {
    const path = join(folder, "last-api-url");
    for (const content of [
      "",
      "not an address",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://user:pw@example.com",
    ]) {
      await writeFile(path, content);
      expect(await createLastApiUrl(path).read(), content).toBeNull();
    }
  });

  it("refuses to remember something that isn't a web address", async () => {
    await expect(createLastApiUrl(join(folder, "last-api-url")).write("ftp://example.com")).rejects.toThrow();
  });

  it("lives beside the logins file", () => {
    expect(defaultLastApiUrlFile({ XDG_CONFIG_HOME: "/cfg" }, "linux")).toBe("/cfg/ace-kit/last-api-url");
  });
});
