import { describe, expect, it, vi } from "vitest";

import { memoryStore } from "../cli/fake-environment";
import { prepareDevSite, wantsDevSite } from "./prepare-dev-site";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const hosted = "https://api.example.com";
const signedIn = () =>
  memoryStore({ [hosted]: { token: "tok", email: "pat@example.com", expiresAt: "2027-01-01T00:00:00Z" } });

describe("wantsDevSite", () => {
  it("is on for a hosted CMS and off for one on this machine", () => {
    expect(wantsDevSite({}, hosted)).toBe(true);
    for (const local of ["http://localhost:8080", "http://127.0.0.1:8080"]) expect(wantsDevSite({}, local)).toBe(false);
  });

  it("can be forced either way with ACE_DEV_SITE", () => {
    expect(wantsDevSite({ ACE_DEV_SITE: "true" }, "http://localhost:8080")).toBe(true);
    expect(wantsDevSite({ ACE_DEV_SITE: "On" }, "http://localhost:8080")).toBe(true);
    for (const value of ["false", "off", "no", "0"])
      expect(wantsDevSite({ ACE_DEV_SITE: value }, hosted), value).toBe(false);
  });
});

describe("prepareDevSite", () => {
  const dev = { id: 9, name: "Acme (dev)", domain: "dev-3.acme.test" };
  function run(
    options: {
      variables?: Record<string, string>;
      store?: ReturnType<typeof memoryStore>;
      routes?: Record<string, Response>;
    } = {},
  ) {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = options.routes?.[`${init?.method ?? "GET"} ${String(input)}`];
      if (!answer) throw new Error(`no route for ${init?.method ?? "GET"} ${String(input)}`);
      return answer;
    });
    return {
      fetchImplementation,
      promise: prepareDevSite({
        apiUrl: hosted,
        variables: { ACE_SITE_DOMAIN: "acme.test", ...options.variables },
        store: options.store ?? signedIn(),
        now: () => Date.parse("2026-10-13T12:00:00Z"),
        fetchImplementation: fetchImplementation as unknown as typeof fetch,
      }),
    };
  }
  const routes = () => ({
    [`GET ${hosted}/sites`]: json([{ id: 7, name: "Acme", domain: "acme.test", kind: "real" }]),
    [`PUT ${hosted}/sites/7/dev-site`]: json(dev, 201),
  });

  it("does nothing when dev sites are off, not even looking for a login", async () => {
    const { promise, fetchImplementation } = run({ variables: { ACE_DEV_SITE: "false" } });
    expect(await promise).toEqual({ kind: "off" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("gets the dev site of the site named by ACE_SITE_DOMAIN", async () => {
    const { promise } = run({ routes: routes() });
    expect(await promise).toEqual({ kind: "ready", site: dev, created: true });
  });

  it("asks to sign in, rather than failing, when there is no login", async () => {
    const { promise, fetchImplementation } = run({ store: memoryStore() });
    expect(await promise).toEqual({ kind: "waiting-for-login", apiUrl: hosted });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("uses ACE_TOKEN when it is set", async () => {
    const { promise } = run({ store: memoryStore(), variables: { ACE_TOKEN: "ci-token" }, routes: routes() });
    expect(await promise).toMatchObject({ kind: "ready" });
  });

  it("asks to sign in again when the login has ended", async () => {
    const { promise } = run({ routes: { [`GET ${hosted}/sites`]: json({}, 401) } });
    expect(await promise).toEqual({ kind: "waiting-for-login", apiUrl: hosted });
  });

  it("says what is wrong when the site isn't found, the account isn't allowed or the CMS is down", async () => {
    const notFound = await run({ variables: { ACE_SITE_DOMAIN: "nope.test" }, routes: routes() }).promise;
    expect(notFound).toMatchObject({ kind: "problem", message: expect.stringContaining("nope.test") });
    expect(notFound).toMatchObject({ message: expect.stringContaining("acme.test") });

    const forbidden = await run({
      routes: {
        ...routes(),
        [`PUT ${hosted}/sites/7/dev-site`]: json({ error: "only partners and super admins can have dev sites" }, 403),
      },
    }).promise;
    expect(forbidden).toMatchObject({
      kind: "problem",
      message: expect.stringContaining("Only partners and super admins"),
    });

    const down = await run({ routes: { [`GET ${hosted}/sites`]: json({}, 500) } }).promise;
    expect(down.kind).toBe("problem");
  });
});
