import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { defaultLoginFile } from "./file-store";
import { normaliseApiUrl } from "./login-store";

/** The API address the person last signed in to, so the other commands don't ask for it every time. Not a secret. */
export interface LastApiUrl {
  read(): Promise<string | null>;
  write(apiUrl: string): Promise<void>;
}

/** Where it is written: beside the logins file, in the same private folder. */
export function defaultLastApiUrlFile(
  variables: Record<string, string | undefined>,
  platform: NodeJS.Platform,
): string {
  return join(dirname(defaultLoginFile(variables, platform)), "last-api-url");
}

export function createLastApiUrl(path: string): LastApiUrl {
  return {
    async read() {
      try {
        // It is checked as an address again, in case the file was edited or damaged.
        return normaliseApiUrl((await readFile(path, "utf8")).trim());
      } catch {
        return null;
      }
    },
    async write(apiUrl) {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, `${normaliseApiUrl(apiUrl)}\n`, { mode: 0o600 });
      await rename(temporary, path);
    },
  };
}
