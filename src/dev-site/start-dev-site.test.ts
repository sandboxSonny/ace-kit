import { afterEach, describe, expect, it } from "vitest";

import { memoryStore } from "../cli/fake-environment";
import { startDevSite } from "./start-dev-site";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const hosted = "https://api.example.com";
const dev = { id: 9, name: "Acme (dev)", domain: "dev-3.acme.test" };

const saved = {
  domain: process.env.ACE_SITE_DOMAIN,
  active: process.env.ACE_DEV_SITE_ACTIVE,
  vitest: process.env.VITEST,
};
afterEach(() => {
  for (const [name, value] of [
    ["ACE_SITE_DOMAIN", saved.domain],
    ["ACE_DEV_SITE_ACTIVE", saved.active],
    ["VITEST", saved.vitest],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function setup(variables: Record<string, string | undefined>, loggedIn = true, put = json(dev, 201)) {
  // Dev servers of a site's own tests skip all this; this test is about the real thing.
  delete process.env.VITEST;
  const requests: { address: string; method: string; body?: string }[] = [];
  const messages: string[] = [];
  const store = memoryStore(
    loggedIn ? { [hosted]: { token: "tok", email: "pat@example.com", expiresAt: "2027-01-01T00:00:00Z" } } : {},
  );
  const environment = {
    variables: { ACE_API_URL: hosted, ACE_SITE_DOMAIN: "acme.test", ...variables },
    store,
    now: () => Date.parse("2026-10-13T12:00:00Z"),
    fetchImplementation: (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ address: String(input), method: init?.method ?? "GET", body: init?.body as string | undefined });
      if (init?.method === "PUT") return put.clone();
      return json([{ id: 7, name: "Acme", domain: "acme.test", kind: "real" }]);
    }) as typeof fetch,
  };
  const log = {
    info: (text: string) => messages.push(`info: ${text}`),
    warn: (text: string) => messages.push(`warn: ${text}`),
  };
  return {
    environment,
    log,
    requests,
    messages,
    start: () => startDevSite({ root: "/site", mode: "development", log, environment }),
  };
}

describe("startDevSite", () => {
  it("points the process at the dev site, so the site and the section sync both use it", async () => {
    const created = setup({});
    const session = await created.start();
    expect(session?.domain).toBe("dev-3.acme.test");
    expect(process.env.ACE_SITE_DOMAIN).toBe("dev-3.acme.test");
    expect(process.env.ACE_DEV_SITE_ACTIVE).toBe("1");
    expect(created.messages.join("\n")).toMatch(
      /Made you a dev site.*live site is not touched|live site is not touched/s,
    );
  });

  it("takes the site's domain from the site setting (Astro's `site`) when ACE_SITE_DOMAIN is not set", async () => {
    const created = setup({ ACE_SITE_DOMAIN: undefined });
    const session = await startDevSite({
      root: "/site",
      mode: "development",
      siteDomain: "acme.test",
      log: created.log,
      environment: created.environment,
    });
    expect(session?.domain).toBe("dev-3.acme.test");
    // And ACE_SITE_DOMAIN, when it is set, wins over it.
    const winning = setup({ ACE_SITE_DOMAIN: "acme.test" });
    expect(
      await startDevSite({
        root: "/site",
        mode: "development",
        siteDomain: "other.test",
        log: winning.log,
        environment: winning.environment,
      }),
    ).not.toBeNull();
  });

  it("says it is reusing a dev site it found", async () => {
    const created = setup({}, true, json(dev, 200));
    await created.start();
    expect(created.messages[0]).toMatch(/Using your dev site/);
  });

  it("tells the CMS where the dev server runs, once it is known", async () => {
    const created = setup({});
    const session = await created.start();
    await session?.setPreviewUrl("http://localhost:4321");
    const last = created.requests.at(-1);
    expect(last?.address).toBe(`${hosted}/sites/7/dev-site`);
    expect(JSON.parse(last?.body ?? "{}")).toEqual({ preview_url: "http://localhost:4321" });
  });

  it("leaves everything as it was, and says why, when not signed in", async () => {
    delete process.env.ACE_DEV_SITE_ACTIVE;
    const created = setup({}, false);
    expect(await created.start()).toBeNull();
    expect(process.env.ACE_SITE_DOMAIN).toBe(saved.domain);
    expect(process.env.ACE_DEV_SITE_ACTIVE).toBeUndefined();
    expect(created.messages.join()).toContain(`npx ace-kit login --api-url ${hosted}`);
    expect(created.requests).toEqual([]);
  });

  it("does nothing for a CMS on this machine, unless asked", async () => {
    const local = setup({ ACE_API_URL: "http://localhost:8080" });
    expect(await local.start()).toBeNull();
    expect(local.requests).toEqual([]);
  });

  it("does nothing in a site's own tests", async () => {
    const created = setup({});
    process.env.VITEST = "true";
    expect(
      await startDevSite({ root: "/site", mode: "development", log: created.log, environment: created.environment }),
    ).toBeNull();
    expect(
      await startDevSite({ root: "/site", mode: "test", log: created.log, environment: created.environment }),
    ).toBeNull();
    expect(created.requests).toEqual([]);
  });

  it("warns, and carries on with the live site, when the CMS says no", async () => {
    const created = setup({}, true, json({ error: "only partners and super admins can have dev sites" }, 403));
    expect(await created.start()).toBeNull();
    expect(process.env.ACE_SITE_DOMAIN).toBe(saved.domain);
    expect(created.messages.join()).toContain("warn: No dev site");
  });
});
