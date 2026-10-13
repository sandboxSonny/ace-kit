import { defaultLoginFile, createFileStore } from "./file-store";
import { createKeychainStore } from "./keychain-store";
import type { CommandRunner } from "./keychain-store";
import type { LoginStore } from "./login-store";

/**
 * Where this machine keeps logins: the Keychain on a Mac, otherwise a private file. Set ACE_KIT_CREDENTIALS=file
 * to use the file even on a Mac (for CI, or to look at what is kept). The Keychain is only used if the
 * `security` program really is there.
 */
export async function chooseLoginStore(options: {
  platform: NodeJS.Platform;
  variables: Record<string, string | undefined>;
  run: CommandRunner;
}): Promise<LoginStore> {
  const file = createFileStore(defaultLoginFile(options.variables, options.platform));
  if (options.platform !== "darwin" || options.variables.ACE_KIT_CREDENTIALS === "file") return file;
  try {
    // `security help` exits non-zero but proves the program exists; a missing program makes the runner throw.
    await options.run("security", ["help"]);
    return createKeychainStore(options.run);
  } catch {
    return file;
  }
}
