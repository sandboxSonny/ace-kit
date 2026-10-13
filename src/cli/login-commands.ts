import { parseArgs } from "node:util";

import { DeviceLoginError, startDeviceLogin, waitForApproval } from "../auth/device-login";
import { normaliseApiUrl } from "../auth/login-store";
import { resolveLogin } from "../auth/resolve-login";
import type { CliEnvironment } from "./environment";

export const loginUsage = `ace-kit login: sign in to CMS Ace from the command line.

Usage:
  ace-kit login  [--api-url <address>]    Sign in. Opens the admin app, where you type the code shown here.
  ace-kit logout [--api-url <address>]    Sign out, and forget the login kept on this machine.
  ace-kit whoami [--api-url <address>]    Say who you are signed in as.

Options:
  --api-url   Where the CMS Ace API lives (or set ACE_API_URL, in the environment or a .env file).
  --help      Show this message.

The login is kept in the macOS Keychain, or in a file only you can read on other systems. On a build server,
where nobody can approve a login in a browser, set ACE_TOKEN instead.
`;

const requestTimeoutMilliseconds = 15_000;

/**
 * Reads --api-url, then ACE_API_URL, then the address last signed in to. Returns null after saying what is
 * wrong.
 */
async function readApiUrl(
  commandArguments: string[],
  environment: CliEnvironment,
): Promise<{ apiUrl: string } | { help: true } | null> {
  const { values } = parseArgs({
    // eslint-disable-next-line id-denylist -- "args" is the name node's parseArgs gives this option.
    args: commandArguments,
    options: { "api-url": { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) return { help: true };
  const address = values["api-url"] ?? environment.variables.ACE_API_URL ?? (await environment.lastApiUrl.read());
  if (!address) {
    environment.error(
      "Give the API address: --api-url, or ACE_API_URL in the environment or a .env file. (Once you have signed in, that address is remembered.)",
    );
    return null;
  }
  try {
    return { apiUrl: normaliseApiUrl(address) };
  } catch (error) {
    environment.error(error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** A web address a browser may be sent to, or null: the CMS chooses it, so nothing but http and https is opened. */
function webAddress(address: string): string | null {
  try {
    const parsed = new URL(address);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

const isLocal = (apiUrl: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname);

export async function loginCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const read = await readApiUrl(commandArguments, environment);
  if (!read) return 1;
  if ("help" in read) {
    environment.out(loginUsage);
    return 0;
  }
  const { apiUrl } = read;
  if (apiUrl.startsWith("http://") && !isLocal(apiUrl)) {
    environment.error(
      `Warning: ${apiUrl} is not encrypted (http://), so the login could be read on the way. Use https:// if you can.`,
    );
  }

  try {
    const request = await startDeviceLogin({
      fetchImplementation: environment.fetchImplementation,
      apiUrl,
      clientName: `ace-kit ${environment.version} on ${environment.hostname}`,
    });
    const page = webAddress(request.verificationUri);
    if (!page)
      throw new DeviceLoginError(
        "unsupported",
        "The CMS sent an approval address that isn't a web address, so it was not opened.",
      );

    environment.out(`Signing in to ${apiUrl}\n`);
    environment.out(`  1. Go to   ${page}`);
    environment.out(`  2. Type    ${request.userCode}\n`);
    environment.out("Check the code on that page matches. Waiting for you to approve it (Ctrl-C to cancel)...");
    // The address is printed above, so a browser that can't be opened is not the end of the login.
    await environment.openBrowser(page).catch(() => undefined);

    const login = await waitForApproval({
      fetchImplementation: environment.fetchImplementation,
      apiUrl,
      request,
      sleep: environment.sleep,
      now: environment.now,
    });
    await environment.store.write(apiUrl, login);
    // Remembered so `whoami` and `logout` know where to look. If it can't be written, nothing is lost but the convenience.
    await environment.lastApiUrl.write(apiUrl).catch(() => undefined);
    environment.out(`\nSigned in as ${login.email}. The login is kept in ${environment.store.description}.`);
    return 0;
  } catch (error) {
    environment.error(`\n${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

export async function logoutCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const read = await readApiUrl(commandArguments, environment);
  if (!read) return 1;
  if ("help" in read) {
    environment.out(loginUsage);
    return 0;
  }
  const { apiUrl } = read;

  const stored = await environment.store.read(apiUrl);
  if (!stored) {
    environment.out(`Not signed in to ${apiUrl}.`);
    return 0;
  }
  // The CMS is told so the login ends there too, not just here. If that can't be done the login is still forgotten.
  const ended = await environment
    .fetchImplementation(`${apiUrl}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stored.token}` },
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    })
    .then(
      (response) => response.ok || response.status === 401,
      () => false,
    );
  await environment.store.remove(apiUrl);
  environment.out(
    ended
      ? `Signed out of ${apiUrl}.`
      : `Forgot the login for ${apiUrl} on this machine, but could not reach the CMS to end it there. It ends by itself after 30 days unused; a super admin can also end it from the Sessions screen.`,
  );
  return 0;
}

export async function whoamiCommand(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const read = await readApiUrl(commandArguments, environment);
  if (!read) return 1;
  if ("help" in read) {
    environment.out(loginUsage);
    return 0;
  }
  const { apiUrl } = read;

  const login = await resolveLogin({
    apiUrl,
    variables: environment.variables,
    store: environment.store,
    now: environment.now,
  });
  if (!login) {
    environment.out(`Not signed in to ${apiUrl}. Run: ace-kit login`);
    return 1;
  }
  try {
    const response = await environment.fetchImplementation(`${apiUrl}/auth/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${login.token}` },
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
    if (response.status === 401) {
      environment.out(`The login from ${login.source} has ended. Run: ace-kit login`);
      return 1;
    }
    if (!response.ok) {
      environment.error(`The CMS answered with an error (${response.status}).`);
      return 1;
    }
    const me = (await response.json()) as { email?: unknown };
    environment.out(`Signed in to ${apiUrl} as ${String(me.email)}, using the login in ${login.source}.`);
    return 0;
  } catch {
    environment.error(`Could not reach the CMS at ${apiUrl}.`);
    return 1;
  }
}
