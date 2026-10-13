import { normaliseApiUrl } from "../auth/login-store";
import { hostedApiUrl } from "../helpers/platform";
import type { CliEnvironment } from "./environment";

/**
 * The API address a command should use, from `--api-url`, then ACE_API_URL, then the address last signed in to, then
 * the hosted CMS Ace. Returns null after saying what is wrong.
 */
export async function resolveApiUrl(
  fromOption: string | undefined,
  environment: CliEnvironment,
): Promise<string | null> {
  const address =
    fromOption ?? environment.variables.ACE_API_URL ?? (await environment.lastApiUrl.read()) ?? hostedApiUrl;
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
