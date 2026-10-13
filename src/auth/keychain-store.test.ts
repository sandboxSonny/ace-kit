import { describe, expect, it } from "vitest";

import { createKeychainStore } from "./keychain-store";
import type { CommandRunner } from "./keychain-store";

const login = { token: "very-secret-token-value", email: "sam@example.com", expiresAt: "2026-12-01T00:00:00Z" };

/**
 * A stand-in for the `security` program: it keeps items in memory, understands the commands the store uses,
 * and records everything it was given so a test can look for the token in it.
 */
function fakeSecurity(options: { forgetsWrites?: boolean; writeExitCode?: number } = {}) {
  const items = new Map<string, string>();
  const calls: { command: string; commandArguments: string[]; input?: string }[] = [];
  const run: CommandRunner = async (command, commandArguments, input) => {
    calls.push({ command, commandArguments, input });
    const flag = (name: string) => commandArguments[commandArguments.indexOf(name) + 1];
    if (commandArguments[0] === "-i") {
      const line = (input ?? "").trim();
      const account = /-a "([^"]*)"/.exec(line)?.[1];
      const secret = /-w "([^"]*)"/.exec(line)?.[1];
      if (line.startsWith("add-generic-password") && account && secret && !options.forgetsWrites)
        items.set(account, secret);
      return { exitCode: options.writeExitCode ?? 0, stdout: "" };
    }
    if (commandArguments[0] === "find-generic-password") {
      const secret = items.get(flag("-a") ?? "");
      return secret === undefined ? { exitCode: 44, stdout: "" } : { exitCode: 0, stdout: `${secret}\n` };
    }
    if (commandArguments[0] === "delete-generic-password") {
      items.delete(flag("-a") ?? "");
      return { exitCode: 0, stdout: "" };
    }
    return { exitCode: 1, stdout: "" };
  };
  return { run, items, calls };
}

describe("the Keychain store", () => {
  it("keeps a login and gives it back, and forgets it", async () => {
    const { run } = fakeSecurity();
    const store = createKeychainStore(run);
    expect(await store.read("http://localhost:8080")).toBeNull();
    await store.write("http://localhost:8080", login);
    expect(await store.read("http://localhost:8080")).toEqual(login);
    await store.remove("http://localhost:8080");
    expect(await store.read("http://localhost:8080")).toBeNull();
  });

  it("keeps one item per API, found however the address is written", async () => {
    const { run, items } = fakeSecurity();
    const store = createKeychainStore(run);
    await store.write("http://localhost:8080", login);
    await store.write("https://api.example.com/", { ...login, email: "other@example.com" });
    expect([...items.keys()].sort()).toEqual(["http://localhost:8080", "https://api.example.com"]);
    expect((await store.read("HTTP://LOCALHOST:8080/"))?.email).toBe("sam@example.com");
  });

  it("never puts the token on a command line, where other users of the machine could read it", async () => {
    const { run, calls, items } = fakeSecurity();
    const store = createKeychainStore(run);
    await store.write("http://localhost:8080", login);
    await store.read("http://localhost:8080");
    await store.remove("http://localhost:8080");

    for (const call of calls) {
      const visible = [call.command, ...call.commandArguments].join(" ");
      expect(visible, visible).not.toContain(login.token);
      expect(visible, visible).not.toContain(Buffer.from(JSON.stringify(login)).toString("base64"));
    }
    // It is handed over on standard input instead, to the interactive mode of the program.
    const write = calls.find((call) => call.commandArguments[0] === "-i");
    expect(write?.input).toContain("add-generic-password");
    expect(write?.input).toContain('-s "ace-kit"');
    expect(write?.input).toContain('-a "http://localhost:8080"');
    expect(write?.input).toContain(" -U");
    // And what is stored is not the plain token.
    items.set("x", "y");
    expect([...items.values()].some((stored) => stored.includes(login.token))).toBe(false);
  });

  it("replaces the login of an API it already had", async () => {
    const { run } = fakeSecurity();
    const store = createKeychainStore(run);
    await store.write("http://localhost:8080", login);
    await store.write("http://localhost:8080", { ...login, token: "a-newer-token" });
    expect((await store.read("http://localhost:8080"))?.token).toBe("a-newer-token");
  });

  it("notices when the Keychain did not keep what it was given, instead of claiming success", async () => {
    const { run } = fakeSecurity({ forgetsWrites: true });
    await expect(createKeychainStore(run).write("http://localhost:8080", login)).rejects.toThrow(/could not be saved/);
  });

  it("reads a damaged item as no login", async () => {
    const { run, items } = fakeSecurity();
    const store = createKeychainStore(run);
    for (const stored of [
      "!!!not base64 json!!!",
      Buffer.from("[1]").toString("base64"),
      Buffer.from('{"token":5}').toString("base64"),
      "",
    ]) {
      items.set("http://localhost:8080", stored);
      expect(await store.read("http://localhost:8080"), stored).toBeNull();
    }
  });

  it("says in words where the login is kept", () => {
    expect(createKeychainStore(fakeSecurity().run).description).toBe("the macOS Keychain");
  });
});
