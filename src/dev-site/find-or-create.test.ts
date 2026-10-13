import { describe, expect, it, vi } from "vitest";

import { findOrCreateDevSite } from "./find-or-create";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const live = { id: 7, name: "Acme", domain: "acme.test", kind: "real" };
const devCopy = { id: 9, name: "Acme (dev)", domain: "dev-3.acme.test", kind: "dev" };

function run(answers: { sites?: Response | Error; put?: Response | Error }, previewUrl?: string, domain = "acme.test") {
  const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const answer = init?.method === "PUT" ? answers.put : answers.sites;
    if (answer instanceof Error) throw answer;
    if (!answer) throw new Error("unexpected request");
    return answer;
  });
  return {
    fetchImplementation,
    promise: findOrCreateDevSite({
      apiUrl: "http://cms.test",
      siteDomain: domain,
      token: "the-token",
      previewUrl,
      fetchImplementation: fetchImplementation as unknown as typeof fetch,
    }),
  };
}

describe("findOrCreateDevSite", () => {
  it("asks the CMS for the dev site of the site with that domain, and says when it was just made", async () => {
    const { promise, fetchImplementation } = run({ sites: json([{ ...live }]), put: json(devCopy, 201) });
    expect(await promise).toEqual({ kind: "created", site: { id: 9, name: "Acme (dev)", domain: "dev-3.acme.test" } });
    const calls = fetchImplementation.mock.calls;
    expect(String(calls[1][0])).toBe("http://cms.test/sites/7/dev-site");
    expect(calls[1][1]?.method).toBe("PUT");
    expect((calls[1][1]?.headers as Record<string, string>).Authorization).toBe("Bearer the-token");
    expect(calls[1][1]?.body).toBeUndefined();
  });

  it("says when the developer already had one", async () => {
    const { promise } = run({ sites: json([live]), put: json(devCopy, 200) });
    expect(await promise).toMatchObject({ kind: "found", site: { id: 9 } });
  });

  it("sends the address the dev server runs at", async () => {
    const { promise, fetchImplementation } = run({ sites: json([live]), put: json(devCopy) }, "http://localhost:4321");
    await promise;
    expect(JSON.parse(String(fetchImplementation.mock.calls[1][1]?.body))).toEqual({
      preview_url: "http://localhost:4321",
    });
  });

  it("uses a domain that is already a dev site's as it is, asking for nothing more", async () => {
    const { promise, fetchImplementation } = run(
      { sites: json([live, devCopy]) },
      "http://localhost:4321",
      "dev-3.acme.test",
    );
    expect(await promise).toEqual({
      kind: "found",
      site: { id: 9, name: "Acme (dev)", domain: "dev-3.acme.test", kind: "dev" },
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("lists the real sites when the domain is not one of them, leaving the dev sites out", async () => {
    const { promise } = run({ sites: json([live, devCopy]) }, undefined, "nope.test");
    expect(await promise).toEqual({ kind: "site-not-found", domain: "nope.test", available: ["acme.test"] });
  });

  it("reports an ended login, a refusal, a rejection and an unreachable CMS", async () => {
    expect(await run({ sites: json({}, 401) }).promise).toEqual({ kind: "login-ended" });
    expect(await run({ sites: json([live]), put: json({}, 401) }).promise).toEqual({ kind: "login-ended" });
    expect(await run({ sites: json([live]), put: json({ error: "only partners" }, 403) }).promise).toEqual({
      kind: "forbidden",
      message: "only partners",
    });
    expect(await run({ sites: json([live]), put: json({ error: "bad" }, 400) }).promise).toEqual({
      kind: "rejected",
      message: "bad",
    });
    expect(await run({ sites: json({}, 500) }).promise).toMatchObject({ kind: "rejected" });
    expect(await run({ sites: new TypeError("offline") }).promise).toEqual({ kind: "unreachable" });
    expect(await run({ sites: json([live]), put: new TypeError("offline") }).promise).toEqual({ kind: "unreachable" });
    expect(await run({ sites: json([live]), put: json({ unexpected: true }, 200) }).promise).toMatchObject({
      kind: "rejected",
    });
  });
});
