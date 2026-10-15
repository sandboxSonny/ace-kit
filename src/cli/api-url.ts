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

/**
 * How a message names the CMS. The hosted CMS Ace is just "CMS Ace": nobody using it needs to see an address. A CMS
 * on someone's own machine is named by its address, which is what tells them where they are connected.
 */
export const cmsName = (apiUrl: string) => (apiUrl === hostedApiUrl ? "CMS Ace" : `the CMS at ${apiUrl}`);

/** The same without "the CMS at", for a sentence that reads "Signed in to ...". */
export const cmsLabel = (apiUrl: string) => (apiUrl === hostedApiUrl ? "CMS Ace" : apiUrl);

/** The command to sign in again: only a CMS that isn't the hosted one needs to be named. */
export const loginCommandFor = (apiUrl: string) =>
  apiUrl === hostedApiUrl ? "npx ace-kit login" : `npx ace-kit login --api-url ${apiUrl}`;

/** Whether an API address is on this machine. */
export function isLocalApiUrl(apiUrl: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname);
}
