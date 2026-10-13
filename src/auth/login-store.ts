/** What is kept after `ace-kit login`: the token the CMS gave, when it stops working, and who it is for. */
export type StoredLogin = {
  token: string;
  /** When the CMS ends the login at the latest (an ISO date). */
  expiresAt: string;
  email: string;
};

/** Somewhere a login is kept between commands, one per CMS Ace API address. */
export interface LoginStore {
  /** Where it is kept, in words for the person: "the macOS Keychain", or the path of a file. */
  readonly description: string;
  read(apiUrl: string): Promise<StoredLogin | null>;
  write(apiUrl: string, login: StoredLogin): Promise<void>;
  remove(apiUrl: string): Promise<void>;
}

/**
 * The form an API address is kept under: the same address written differently ("HTTP://Localhost:8080/") is
 * the same CMS. Only web addresses are allowed, with no username or password in them.
 */
export function normaliseApiUrl(address: string): string {
  let parsed: URL;
  try {
    parsed = new URL(address.trim());
  } catch {
    throw new Error(`"${address}" is not a web address. Write the API address like http://localhost:8080.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`The API address must start with http:// or https:// (it was "${address}").`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("The API address must not contain a username or password.");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

/** Whether a stored login has run past the time the CMS gave. */
export function hasExpired(login: StoredLogin, now: number): boolean {
  const endsAt = Date.parse(login.expiresAt);
  return Number.isNaN(endsAt) || endsAt <= now;
}

/** Reads a stored login out of whatever was kept, or null if it isn't one. */
export function parseStoredLogin(value: unknown): StoredLogin | null {
  if (typeof value !== "object" || value === null) return null;
  const { token, expiresAt, email } = value as Record<string, unknown>;
  if (typeof token !== "string" || token === "" || typeof expiresAt !== "string" || typeof email !== "string")
    return null;
  return { token, expiresAt, email };
}
