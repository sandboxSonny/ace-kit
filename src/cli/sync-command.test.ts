import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defineSection } from "../sections/define-section";
import { fakeEnvironment, json } from "./fake-environment";
import type { Routes } from "./fake-environment";
import { runCli } from "./main";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ace-kit-sync-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const hero = defineSection({
  handle: "hero",
  name: "Hero",
  fields: [{ handle: "heading", label: "Heading", type: "text", required: true }],
});
const faq = defineSection({
  handle: "faq",
  name: "FAQ",
  blocks: { question: { name: "Question", fields: [{ handle: "question", label: "Question", type: "text" }] } },
});

/** Makes the schema files (empty: the test says what each one exports) and returns an environment that sees them. */
async function setup(
  schemas: Record<string, unknown>,
  options: { routes?: Routes; variables?: Record<string, string>; signedIn?: boolean; apiUrl?: string } = {},
) {
  for (const name of Object.keys(schemas)) {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", name), "");
  }
  const apiUrl = options.apiUrl ?? "http://localhost:8080";
  const routes: Routes = options.routes ?? {
    [`GET ${apiUrl}/sites`]: () => json([{ id: 5, domain: "localhost" }]),
    [`PUT ${apiUrl}/sites/5/section-types`]: () =>
      json({
        // The CMS answers with a site's section types sorted, whatever order they were sent in.
        sections: Object.values(schemas)
          .map((module) => ({ handle: (module as { default: { handle: string } }).default.handle, name: "x" }))
          .sort((first, second) => first.handle.localeCompare(second.handle)),
        warnings: [],
      }),
  };
  const created = fakeEnvironment(routes, {
    variables: options.variables ?? {},
    workingDirectory: root,
    importModule: async (path) => {
      const module = schemas[basename(path)];
      if (module instanceof Error) throw module;
      return module;
    },
  });
  if (options.signedIn !== false)
    created.store.items[apiUrl] = { token: "the-token", email: "sam@example.com", expiresAt: "2027-01-01T00:00:00Z" };
  return created;
}

const synced = (created: { requests: { address: string; init?: RequestInit }[] }) =>
  created.requests.filter((request) => request.init?.method === "PUT");

describe("ace-kit sync", () => {
  it("sends every section type found to the site, and says what it did", async () => {
    const { environment, output, errors, requests } = await setup({
      "Hero.schema.ts": { default: hero },
      "Faq.schema.ts": { default: faq },
    });
    expect(await runCli(["sync"], environment)).toBe(0);
    expect(output.join("\n")).toBe("Synced 2 section types (faq, hero) to localhost (http://localhost:8080).");
    expect(errors).toEqual([]);

    const put = requests.find((request) => request.init?.method === "PUT")!;
    expect(put.address).toBe("http://localhost:8080/sites/5/section-types");
    expect(JSON.parse(String(put.init?.body)).sections.map((section: { handle: string }) => section.handle)).toEqual([
      "faq",
      "hero",
    ]);
    expect((put.init?.headers as Record<string, string>).Authorization).toBe("Bearer the-token");
  });

  it("says retired sections are kept, and passes on warnings", async () => {
    const created = await setup(
      { "Hero.schema.ts": { default: hero } },
      {
        routes: {
          "GET http://localhost:8080/sites": () => json([{ id: 5, domain: "localhost" }]),
          "PUT http://localhost:8080/sites/5/section-types": () =>
            json({
              sections: [
                { handle: "hero", name: "Hero" },
                { handle: "old", name: "Old", retired_at: "2026-10-01T00:00:00Z" },
              ],
              warnings: ['section "hero": field "price" is a text field and was not changed to a number field'],
            }),
        },
      },
    );
    expect(await runCli(["sync"], created.environment)).toBe(0);
    expect(created.output.join("\n")).toBe(
      "Synced 1 section type (hero) to localhost (http://localhost:8080). No longer in your code, kept but hidden: old.",
    );
    expect(created.errors).toEqual([
      'Warning: section "hero": field "price" is a text field and was not changed to a number field',
    ]);
  });

  it("sends nothing at all if any schema file can't be used, so the sections of the others are not retired", async () => {
    const created = await setup({
      "Hero.schema.ts": { default: hero },
      "Broken.schema.ts": new SyntaxError("Unexpected token '}'"),
      "Bad.schema.ts": { default: { handle: "Nope Nope", name: "" } },
    });
    expect(await runCli(["sync"], created.environment)).toBe(1);
    expect(created.requests).toEqual([]);
    const shown = created.errors.join("\n");
    expect(shown).toContain("Broken.schema.ts: could not be loaded: Unexpected token '}'");
    expect(shown).toContain("Bad.schema.ts");
    expect(shown).toContain("Nothing was synced");
  });

  it("sends nothing when there are no schema files, since that would retire every section", async () => {
    const created = await setup({});
    expect(await runCli(["sync"], created.environment)).toBe(0);
    expect(created.requests).toEqual([]);
    expect(created.output.join("\n")).toContain("No *.schema.ts files found in src, so nothing was synced");
  });

  it("says to sign in, and sends nothing, when there is no login", async () => {
    const created = await setup({ "Hero.schema.ts": { default: hero } }, { signedIn: false });
    expect(await runCli(["sync"], created.environment)).toBe(1);
    expect(created.requests).toEqual([]);
    expect(created.output.join("\n")).toContain("Run: npx ace-kit login --api-url http://localhost:8080");
  });

  it("works on a build server with ACE_TOKEN and no stored login", async () => {
    const created = await setup(
      { "Hero.schema.ts": { default: hero } },
      { signedIn: false, variables: { ACE_TOKEN: "ci-token" } },
    );
    expect(await runCli(["sync"], created.environment)).toBe(0);
    expect((created.requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer ci-token");
  });

  it("uses the same defaults as the Astro integration, and settings and options in that order", async () => {
    const defaults = await setup({ "Hero.schema.ts": { default: hero } });
    await runCli(["sync"], defaults.environment);
    expect(defaults.requests[0].address).toBe("http://localhost:8080/sites");

    const fromSettings = await setup(
      { "Hero.schema.ts": { default: hero } },
      {
        apiUrl: "http://cms.test:9000",
        variables: { ACE_API_URL: "http://cms.test:9000", ACE_SITE_DOMAIN: "Example.Test" },
        routes: {
          "GET http://cms.test:9000/sites": () => json([{ id: 2, domain: "example.test" }]),
          "PUT http://cms.test:9000/sites/2/section-types": () =>
            json({ sections: [{ handle: "hero", name: "Hero" }] }),
        },
      },
    );
    expect(await runCli(["sync"], fromSettings.environment)).toBe(0);
    expect(fromSettings.output.join()).toContain("to example.test (http://cms.test:9000)");

    const fromOptions = await setup(
      { "Hero.schema.ts": { default: hero } },
      {
        apiUrl: "http://other.test:1",
        variables: { ACE_API_URL: "http://cms.test:9000", ACE_SITE_DOMAIN: "ignored.test" },
        routes: {
          "GET http://other.test:1/sites": () => json([{ id: 3, domain: "mine.test" }]),
          "PUT http://other.test:1/sites/3/section-types": () => json({ sections: [{ handle: "hero", name: "Hero" }] }),
        },
      },
    );
    expect(
      await runCli(["sync", "--api-url", "http://other.test:1", "--domain", "mine.test"], fromOptions.environment),
    ).toBe(0);
  });

  it("does not use the address last signed in to, which may be a hosted CMS the site isn't pointed at", async () => {
    const created = await setup({ "Hero.schema.ts": { default: hero } });
    created.environment.lastApiUrl = { read: async () => "https://api.ace-cms.co.uk", write: async () => undefined };
    // Signed in there too, so that using that address by mistake would really send something.
    created.store.items["https://api.ace-cms.co.uk"] = {
      token: "production-token",
      email: "sam@example.com",
      expiresAt: "2027-01-01T00:00:00Z",
    };
    await runCli(["sync"], created.environment);
    expect(created.requests.length).toBeGreaterThan(0);
    expect(created.requests.map((request) => request.address).join()).not.toContain("ace-cms.co.uk");
  });

  it("looks in the folder it is told to", async () => {
    const created = await setup({});
    await mkdir(join(root, "app"), { recursive: true });
    await writeFile(join(root, "app", "Hero.schema.ts"), "");
    created.environment.importModule = async () => ({ default: hero });
    expect(await runCli(["sync", "--dir", "app"], created.environment)).toBe(0);
    expect(synced(created)).toHaveLength(1);
  });

  describe("when something goes wrong with the CMS", () => {
    const routes = (sites: Response, put?: Response): Routes => ({
      "GET http://localhost:8080/sites": () => sites,
      "PUT http://localhost:8080/sites/5/section-types": () => put ?? json({}),
    });

    it("lists the sites the person can see when theirs isn't one", async () => {
      const created = await setup(
        { "Hero.schema.ts": { default: hero } },
        {
          routes: routes(
            json([
              { id: 1, domain: "a.test" },
              { id: 2, domain: "b.test" },
            ]),
          ),
        },
      );
      expect(await runCli(["sync"], created.environment)).toBe(1);
      expect(created.errors.join()).toContain(
        'no site with the domain "localhost" that you can see (your sites: a.test, b.test)',
      );
      expect(synced(created)).toEqual([]);
    });

    it("says when the login has ended, when the account may not do it, when the CMS refuses and when it is down", async () => {
      const ended = await setup({ "Hero.schema.ts": { default: hero } }, { routes: routes(json({}, 401)) });
      expect(await runCli(["sync"], ended.environment)).toBe(1);
      expect(ended.output.join()).toContain("Your login has ended");

      const forbidden = await setup(
        { "Hero.schema.ts": { default: hero } },
        { routes: routes(json([{ id: 5, domain: "localhost" }]), json({}, 403)) },
      );
      expect(await runCli(["sync"], forbidden.environment)).toBe(1);
      expect(forbidden.errors.join()).toContain("owners and super admins");

      const rejected = await setup(
        { "Hero.schema.ts": { default: hero } },
        { routes: routes(json([{ id: 5, domain: "localhost" }]), json({ error: "too many sections" }, 400)) },
      );
      expect(await runCli(["sync"], rejected.environment)).toBe(1);
      expect(rejected.errors.join()).toContain("too many sections");

      const down = await setup({ "Hero.schema.ts": { default: hero } }, { routes: {} });
      expect(await runCli(["sync"], down.environment)).toBe(1);
      expect(down.errors.join()).toContain("Could not reach the CMS at http://localhost:8080");
    });
  });

  it("explains itself", async () => {
    const created = await setup({});
    expect(await runCli(["sync", "--help"], created.environment)).toBe(0);
    expect(created.output.join()).toContain("Nothing is deleted");
    expect(created.requests).toEqual([]);
  });
});

describe("ace-kit sync --automatic (what the dev server runs on a save)", () => {
  it("syncs to a local CMS like the plain command does", async () => {
    const created = await setup({ "Hero.schema.ts": { default: hero } });
    expect(await runCli(["sync", "--automatic"], created.environment)).toBe(0);
    expect(synced(created)).toHaveLength(1);
    expect(created.output.join()).toContain("Synced 1 section type");
  });

  it("says nothing, and does nothing, for a site with no schema files", async () => {
    const created = await setup({});
    expect(await runCli(["sync", "--automatic"], created.environment)).toBe(0);
    expect(created.output).toEqual([]);
    expect(created.errors).toEqual([]);
    expect(created.requests).toEqual([]);
  });

  it("does not stop the dev server when there is no login: it says how to sign in and carries on", async () => {
    const created = await setup({ "Hero.schema.ts": { default: hero } }, { signedIn: false });
    expect(await runCli(["sync", "--automatic"], created.environment)).toBe(0);
    expect(created.output.join()).toContain("waiting for you to sign in");
    expect(created.requests).toEqual([]);
  });

  it("does not stop the dev server when the login has ended either", async () => {
    const created = await setup(
      { "Hero.schema.ts": { default: hero } },
      { routes: { "GET http://localhost:8080/sites": () => json({}, 401) } },
    );
    expect(await runCli(["sync", "--automatic"], created.environment)).toBe(0);
    expect(created.output.join()).toContain("Your login has ended");
  });

  it("stays off a hosted CMS unless told it may, so a stray setting can't push half-typed fields into a live site", async () => {
    const hosted = "https://api.example.com";
    const routes: Routes = {
      [`GET ${hosted}/sites`]: () => json([{ id: 5, domain: "localhost" }]),
      [`PUT ${hosted}/sites/5/section-types`]: () => json({ sections: [{ handle: "hero", name: "Hero" }] }),
    };

    const off = await setup(
      { "Hero.schema.ts": { default: hero } },
      { apiUrl: hosted, routes, variables: { ACE_API_URL: hosted } },
    );
    expect(await runCli(["sync", "--automatic"], off.environment)).toBe(0);
    expect(off.requests).toEqual([]);
    expect(off.output.join()).toContain("ACE_SYNC_SECTIONS=remote");

    const allowed = await setup(
      { "Hero.schema.ts": { default: hero } },
      { apiUrl: hosted, routes, variables: { ACE_API_URL: hosted, ACE_SYNC_SECTIONS: "remote" } },
    );
    expect(await runCli(["sync", "--automatic"], allowed.environment)).toBe(0);
    expect(synced(allowed)).toHaveLength(1);

    // Typing the command yourself is always allowed.
    const manual = await setup(
      { "Hero.schema.ts": { default: hero } },
      { apiUrl: hosted, routes, variables: { ACE_API_URL: hosted } },
    );
    expect(await runCli(["sync"], manual.environment)).toBe(0);
    expect(synced(manual)).toHaveLength(1);
  });

  it("can be switched off with ACE_SYNC_SECTIONS", async () => {
    for (const value of ["false", "off", "NO", "0"]) {
      const created = await setup({ "Hero.schema.ts": { default: hero } }, { variables: { ACE_SYNC_SECTIONS: value } });
      expect(await runCli(["sync", "--automatic"], created.environment), value).toBe(0);
      expect(created.requests, value).toEqual([]);
      expect(created.output, value).toEqual([]);
    }
  });

  it("still reports a broken schema file, as an error, because that is what the person needs to see", async () => {
    const created = await setup({ "Broken.schema.ts": new Error("boom") });
    expect(await runCli(["sync", "--automatic"], created.environment)).toBe(1);
    expect(created.errors.join()).toContain("Broken.schema.ts: could not be loaded: boom");
    expect(created.requests).toEqual([]);
  });
});
