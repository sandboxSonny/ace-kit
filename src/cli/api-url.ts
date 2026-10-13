import { normaliseApiUrl } from "../auth/login-store";
import type { CliEnvironment } from "./environment";

/**
 * The API address a command should use, from `--api-url`, then ACE_API_URL, then the address last signed in to.
 * Returns null after saying what is wrong.
 */
export async function resolveApiUrl(
  fromOption: string | undefined,
  environment: CliEnvironment,
): Promise<string | null> {
  const address = fromOption ?? environment.variables.ACE_API_URL ?? (await environment.lastApiUrl.read());
  if (!address) {
    environment.error(
      "Give the API address: --api-url, or ACE_API_URL in the environment or a .env file. (Once you have signed in, that address is remembered.)",
    );
    return null;
  }
  try {
    return normaliseApiUrl(address);
  } catch (error) {
    environment.error(error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** Whether an API address is on this machine. */
export function isLocalApiUrl(apiUrl: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname);
}
