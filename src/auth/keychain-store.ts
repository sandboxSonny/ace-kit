import { normaliseApiUrl, parseStoredLogin } from "./login-store";
import type { LoginStore, StoredLogin } from "./login-store";

/** Runs a program and says how it ended. `input`, if given, is written to its standard input. */
export type CommandRunner = (
  command: string,
  commandArguments: string[],
  input?: string,
) => Promise<{ exitCode: number; stdout: string }>;

const keychainService = "ace-kit";

/**
 * Keeps logins in the macOS Keychain, through the `security` program that comes with the system, so there
 * are no native modules to install. One item per API address: its account is the address, its password is the
 * login, written as base64 so nothing in it needs quoting.
 *
 * The login is handed to `security` on its standard input (`security -i`), never as an argument, because
 * the arguments of a running program can be read by other users of the machine with `ps`. `security -i`
 * does not say reliably whether a command failed, so what is written is read back and compared.
 */
export function createKeychainStore(run: CommandRunner): LoginStore {
  async function read(apiUrl: string): Promise<StoredLogin | null> {
    const found = await run("security", [
      "find-generic-password",
      "-s",
      keychainService,
      "-a",
      normaliseApiUrl(apiUrl),
      "-w",
    ]);
    if (found.exitCode !== 0) return null;
    try {
      return parseStoredLogin(JSON.parse(Buffer.from(found.stdout.trim(), "base64").toString("utf8")));
    } catch {
      return null;
    }
  }

  return {
    description: "the macOS Keychain",
    read,
    async write(apiUrl, login) {
      const account = normaliseApiUrl(apiUrl);
      // A web address that has been through the URL parser has no quotes or backslashes, but this is cheap to check.
      if (/["\\\s]/.test(account)) throw new Error("That API address can't be kept in the Keychain.");
      const secret = Buffer.from(JSON.stringify(login), "utf8").toString("base64");
      await run(
        "security",
        ["-i"],
        `add-generic-password -s "${keychainService}" -a "${account}" -l "Ace Kit login" -w "${secret}" -U\n`,
      );
      const kept = await read(apiUrl);
      if (kept?.token !== login.token) throw new Error("The login could not be saved in the macOS Keychain.");
    },
    async remove(apiUrl) {
      // Nothing to remove is fine.
      await run("security", ["delete-generic-password", "-s", keychainService, "-a", normaliseApiUrl(apiUrl)]);
    },
  };
}
