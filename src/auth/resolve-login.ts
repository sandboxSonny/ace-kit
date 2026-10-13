import { hasExpired } from "./login-store";
import type { LoginStore } from "./login-store";

/** The token to call the CMS with, and where it came from. */
export type ResolvedLogin = {
  token: string;
  /** Who it is for, when that is known (it isn't for a token given in the environment). */
  email?: string;
  /** In words for the person: "the ACE_TOKEN setting", "the macOS Keychain" or a file path. */
  source: string;
};

/**
 * Finds the token to use for an API: ACE_TOKEN if it is set (for a build server, where no one can approve
 * a login in a browser), otherwise the login kept by `ace-kit login`, unless that has run out. Returns null
 * when there is none.
 */
export async function resolveLogin(options: {
  apiUrl: string;
  variables: Record<string, string | undefined>;
  store: LoginStore;
  now: () => number;
}): Promise<ResolvedLogin | null> {
  const fromEnvironment = options.variables.ACE_TOKEN?.trim();
  if (fromEnvironment) return { token: fromEnvironment, source: "the ACE_TOKEN setting" };

  const stored = await options.store.read(options.apiUrl);
  if (!stored || hasExpired(stored, options.now())) return null;
  return { token: stored.token, email: stored.email, source: options.store.description };
}
