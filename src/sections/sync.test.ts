import { describe, expect, it, vi } from "vitest";

import { syncSectionTypes } from "./sync";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const payload = { sections: [{ handle: "hero", name: "Hero", fields: [], blocks: [] }] };
const sites = [
  { id: 4, domain: "other.test" },
  { id: 7, domain: "Example.Test" },
];

function run(routes: { sites?: Response | Error; put?: Response | Error }, siteDomain = "example.test") {
  const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const answer = init?.method === "PUT" ? routes.put : routes.sites;
    if (answer instanceof Error) throw answer;
    if (!answer) throw new Error(`unexpected ${init?.method ?? "GET"} ${String(input)}`);
    return answer;
  });
  const promise = syncSectionTypes({
    apiUrl: "http://cms.test",
    siteDomain,
    token: "the-token",
    payload,
    fetchImplementation: fetchImplementation as unknown as typeof fetch,
  });
  return { promise, fetchImplementation };
}

describe("syncSectionTypes", () => {
  it("finds the site by its domain, ignoring case, and sends the full list to its section types", async () => {
    const { promise, fetchImplementation } = run({
      sites: json(sites),
      put: json({
        sections: [
          { handle: "hero", name: "Hero" },
          { handle: "old", name: "Old", retired_at: "2026-10-01T00:00:00Z" },
        ],
        warnings: ["a warning"],
      }),
    });
    expect(await promise).toEqual({
      kind: "synced",
      site: { id: 7, domain: "Example.Test" },
      sections: [
        { handle: "hero", name: "Hero", retired: false },
        { handle: "old", name: "Old", retired: true },
      ],
      warnings: ["a warning"],
    });
    const calls = fetchImplementation.mock.calls;
    expect(String(calls[0][0])).toBe("http://cms.test/sites");
    expect(String(calls[1][0])).toBe("http://cms.test/sites/7/section-types");
    expect(calls[1][1]?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual(payload);
    for (const call of calls)
      expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer the-token");
  });

  it("sends nothing when the site isn't one the person can see, and lists the ones they can", async () => {
    const { promise, fetchImplementation } = run({ sites: json(sites) }, "nope.test");
    expect(await promise).toEqual({
      kind: "site-not-found",
      domain: "nope.test",
      available: ["other.test", "Example.Test"],
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("says when the login has ended, whichever request found out", async () => {
    expect(await run({ sites: json({}, 401) }).promise).toEqual({ kind: "login-ended" });
    expect(await run({ sites: json(sites), put: json({}, 401) }).promise).toEqual({ kind: "login-ended" });
  });

  it("says when the person may not change the site's sections", async () => {
    const outcome = await run({ sites: json(sites), put: json({ error: "forbidden" }, 403) }).promise;
    expect(outcome).toEqual({ kind: "forbidden", message: expect.stringContaining("owners and super admins") });
  });

  it("passes on what the CMS said when it refused the list", async () => {
    expect(
      await run({ sites: json(sites), put: json({ error: 'section "hero": needs a name' }, 400) }).promise,
    ).toEqual({ kind: "rejected", message: 'section "hero": needs a name' });
    expect(await run({ sites: json(sites), put: new Response("<html>", { status: 502 }) }).promise).toEqual({
      kind: "rejected",
      message: "The CMS answered with an error (502).",
    });
    expect(await run({ sites: json({ error: "broken" }, 500) }).promise).toEqual({
      kind: "rejected",
      message: "broken",
    });
  });

  it("says when the CMS can't be reached, at either step", async () => {
    expect(await run({ sites: new TypeError("fetch failed") }).promise).toEqual({ kind: "unreachable" });
    expect(await run({ sites: json(sites), put: new TypeError("fetch failed") }).promise).toEqual({
      kind: "unreachable",
    });
  });

  it("copes with a CMS that answers with something unreadable", async () => {
    expect(await run({ sites: json(sites), put: new Response("not json", { status: 200 }) }).promise).toMatchObject({
      kind: "synced",
      sections: [],
      warnings: [],
    });
  });
});
