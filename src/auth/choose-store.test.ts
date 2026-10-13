import { describe, expect, it, vi } from "vitest";

import { chooseLoginStore } from "./choose-store";

describe("chooseLoginStore", () => {
  it("uses the Keychain on a Mac that has the security program", async () => {
    const run = vi.fn(async () => ({ exitCode: 1, stdout: "" }));
    const store = await chooseLoginStore({ platform: "darwin", variables: {}, run });
    expect(store.description).toBe("the macOS Keychain");
    expect(run).toHaveBeenCalledWith("security", ["help"]);
  });

  it("uses a private file when the security program isn't there", async () => {
    const run = vi.fn(async () => {
      throw new Error("spawn security ENOENT");
    });
    const store = await chooseLoginStore({ platform: "darwin", variables: { XDG_CONFIG_HOME: "/cfg" }, run });
    expect(store.description).toBe("/cfg/ace-kit/credentials.json");
  });

  it("uses a private file when asked to, even on a Mac, without trying the Keychain", async () => {
    const run = vi.fn(async () => ({ exitCode: 0, stdout: "" }));
    const store = await chooseLoginStore({
      platform: "darwin",
      variables: { ACE_KIT_CREDENTIALS: "file", XDG_CONFIG_HOME: "/cfg" },
      run,
    });
    expect(store.description).toBe("/cfg/ace-kit/credentials.json");
    expect(run).not.toHaveBeenCalled();
  });

  it("uses a private file on other systems", async () => {
    const run = vi.fn(async () => ({ exitCode: 0, stdout: "" }));
    for (const platform of ["linux", "win32"] as const) {
      const store = await chooseLoginStore({ platform, variables: { XDG_CONFIG_HOME: "/cfg", APPDATA: "C:\\a" }, run });
      expect(store.description, platform).toMatch(/ace-kit.credentials\.json$/);
    }
    expect(run).not.toHaveBeenCalled();
  });
});
