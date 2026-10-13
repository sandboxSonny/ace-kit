import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { normaliseApiUrl, parseStoredLogin } from "./login-store";
import type { LoginStore, StoredLogin } from "./login-store";

/** Where logins are kept when there is no keychain to keep them in: a file only the person can read. */
export function defaultLoginFile(variables: Record<string, string | undefined>, platform: NodeJS.Platform): string {
  if (platform === "win32" && variables.APPDATA) return join(variables.APPDATA, "ace-kit", "credentials.json");
  const configFolder = variables.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configFolder, "ace-kit", "credentials.json");
}

type LoginsByAddress = Record<string, StoredLogin>;

/**
 * Keeps logins in one JSON file, readable by its owner only (mode 0600, in a folder of mode 0700). This is what
 * npm and the GitHub CLI do when they have nothing better, and it is the same protection a private key in
 * ~/.ssh has. It is written to a new file and moved into place, so a crash can't leave half a file.
 */
export function createFileStore(path: string): LoginStore {
  async function readAll(): Promise<LoginsByAddress> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {};
    }
    const found: LoginsByAddress = {};
    if (typeof parsed === "object" && parsed !== null) {
      for (const [address, value] of Object.entries(parsed)) {
        const login = parseStoredLogin(value);
        if (login) found[address] = login;
      }
    }
    return found;
  }

  async function writeAll(logins: LoginsByAddress): Promise<void> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${process.pid}.tmp`;
    // A new file each time, made private from the start and moved over the old one, so a file that was once
    // more open than it should be does not keep that.
    await writeFile(temporary, `${JSON.stringify(logins, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, path);
  }

  return {
    description: path,
    async read(apiUrl) {
      return (await readAll())[normaliseApiUrl(apiUrl)] ?? null;
    },
    async write(apiUrl, login) {
      const logins = await readAll();
      logins[normaliseApiUrl(apiUrl)] = login;
      await writeAll(logins);
    },
    async remove(apiUrl) {
      const logins = await readAll();
      delete logins[normaliseApiUrl(apiUrl)];
      await writeAll(logins);
    },
  };
}
