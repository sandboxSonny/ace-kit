import { describe, expect, it } from "vitest";

import { resolveLogin } from "./resolve-login";
import type { LoginStore, StoredLogin } from "./login-store";

const now = () => Date.parse("2026-10-13T12:00:00Z");

function storeWith(login: StoredLogin | null): LoginStore {
  return { description: "the test store", read: async () => login, write: async () => {}, remove: async () => {} };
}

const valid: StoredLogin = { token: "stored-token", email: "sam@example.com", expiresAt: "2027-01-01T00:00:00Z" };

describe("resolveLogin", () => {
  it("uses ACE_TOKEN when it is set, before anything stored", async () => {
    const found = await resolveLogin({
      apiUrl: "http://x",
      variables: { ACE_TOKEN: "  from-the-environment  " },
      store: storeWith(valid),
      now,
    });
    expect(found).toEqual({ token: "from-the-environment", source: "the ACE_TOKEN setting" });
  });

  it("ignores an empty ACE_TOKEN", async () => {
    const found = await resolveLogin({
      apiUrl: "http://x",
      variables: { ACE_TOKEN: "   " },
      store: storeWith(valid),
      now,
    });
    expect(found?.token).toBe("stored-token");
  });

  it("uses the stored login, saying who it is for and where it is kept", async () => {
    expect(await resolveLogin({ apiUrl: "http://x", variables: {}, store: storeWith(valid), now })).toEqual({
      token: "stored-token",
      email: "sam@example.com",
      source: "the test store",
    });
  });

  it("finds nothing when there is no stored login, or it has run out", async () => {
    expect(await resolveLogin({ apiUrl: "http://x", variables: {}, store: storeWith(null), now })).toBeNull();
    expect(
      await resolveLogin({
        apiUrl: "http://x",
        variables: {},
        store: storeWith({ ...valid, expiresAt: "2026-10-13T11:59:59Z" }),
        now,
      }),
    ).toBeNull();
  });
});
