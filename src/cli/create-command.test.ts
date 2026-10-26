import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fakeEnvironment, json } from "./fake-environment";
import type { Routes } from "./fake-environment";
import { runCli } from "./main";

const api = "http://localhost:8080";
const templatesDirectory = fileURLToPath(new URL("../../templates", import.meta.url));

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ace-kit-create-command-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

const componentKeys = ["text", "richtext", "image", "date", "link", "sections"];

/** A CMS that has no sites and says yes to everything, numbering what it makes. */
function friendlyCms(overrides: Routes = {}): Routes {
  let nextEntryId = 100;
  return {
    [`GET ${api}/sites`]: () => json([{ id: 1, name: "Someone else's", domain: "other.example.com", kind: "real" }]),
    [`POST ${api}/sites`]: () => json({ id: 7 }, 201),
    [`PUT ${api}/sites/7/section-types`]: () => json({ sections: [] }),
    [`GET ${api}/components`]: () => json(componentKeys.map((key, index) => ({ id: index + 1, key }))),
    [`POST ${api}/sites/7/content-types`]: () => json({ id: 3 }, 201),
    [`POST ${api}/sites/7/entries`]: () => json({ id: nextEntryId++ }, 201),
    [`POST ${api}/sites/7/menus`]: () => json({ id: 1 }, 201),
    ...overrides,
  };
}

function setup(routes: Routes = friendlyCms(), options: { signedIn?: boolean } = {}) {
  const created = fakeEnvironment(routes, {
    variables: { ACE_API_URL: api },
    workingDirectory: root,
    version: "0.6.0",
    templatesDirectory,
  });
  if (options.signedIn !== false)
    created.store.items[api] = { token: "the-token", email: "sam@example.com", expiresAt: "2027-01-01T00:00:00Z" };
  return created;
}

const bodyOf = (request: { init?: RequestInit }) => JSON.parse(String(request.init?.body));
const calls = (created: { requests: { address: string; init?: RequestInit }[] }) =>
  created.requests.map((request) => `${request.init?.method ?? "GET"} ${request.address.replace(api, "")}`);

describe("ace-kit create", () => {
  it("makes the site in the CMS, seeds it, then makes the folder", async () => {
    const created = setup();
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(0);
    expect(created.errors).toEqual([]);

    expect(calls(created)).toEqual([
      "GET /sites",
      "POST /sites",
      "PUT /sites/7/section-types",
      "GET /components",
      "POST /sites/7/content-types",
      "POST /sites/7/entries",
      "POST /sites/7/entries",
      "POST /sites/7/entries",
      "POST /sites/7/menus",
    ]);
    for (const request of created.requests)
      expect((request.init?.headers as Record<string, string>).Authorization).toBe("Bearer the-token");

    const [, makeSite, sectionTypes, , contentType, home, about, contact, menu] = created.requests;
    expect(bodyOf(makeSite!)).toEqual({
      name: "My Shop",
      domain: "shop.example.com",
      preview_url: "http://localhost:4321",
    });
    expect(bodyOf(sectionTypes!).sections.map((section: { handle: string }) => section.handle)).toEqual([
      "contact-form",
      "faq",
      "gallery",
      "hero",
    ]);
    expect(bodyOf(contentType!).handle).toBe("pages");
    expect(bodyOf(contentType!).fields.map((field: { handle: string }) => field.handle)).toEqual([
      "headline",
      "body",
      "hero",
      "published",
      "button",
      "content",
    ]);
    expect(bodyOf(home!)).toMatchObject({ content_type_id: 3, handle: "home", title: "Home" });
    expect(bodyOf(home!).values.headline).toBe("Welcome to My Shop");
    expect(bodyOf(home!).values.content.map((section: { type: string }) => section.type)).toEqual(["hero", "faq"]);
    expect(bodyOf(about!).handle).toBe("about");
    // Contact's button links to About, whose ID the CMS gave when it was made.
    expect(bodyOf(contact!).values.button).toEqual({ entryId: 101, label: "Learn about us" });
    expect(bodyOf(menu!).items.map((item: { entry_id: number }) => item.entry_id)).toEqual([100, 101, 102]);

    const shown = created.output.join("\n");
    expect(shown).toContain("Made shop.example.com in CMS Ace");
    expect(shown).toContain("Made My Shop (astro) in my-shop.");
    expect(shown).toContain("npm run dev");
    expect(JSON.parse(await readFile(join(root, "my-shop", "package.json"), "utf8")).name).toBe("my-shop");
  });

  it("points a site made on a local CMS at it, and at the local admin app, so live preview works", async () => {
    const created = setup();
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(0);
    expect(await readFile(join(root, "my-shop", ".env"), "utf8")).toBe(
      "ACE_API_URL=http://localhost:8080\nACE_PREVIEW_ADMIN_ORIGIN=http://localhost:5173\n",
    );

    const react = setup();
    expect(await runCli(["create", "shop-r", "r.example.com", "--framework", "react-router"], react.environment)).toBe(
      0,
    );
    expect(bodyOf(react.requests[1]!).preview_url).toBe("http://localhost:4322");
    expect(await readFile(join(root, "shop-r", ".env"), "utf8")).toBe(
      "ACE_SITE_DOMAIN=r.example.com\nACE_API_URL=http://localhost:8080\nACE_PREVIEW_ADMIN_ORIGIN=http://localhost:5173\n",
    );
  });

  it("writes no settings and no preview address for the hosted CMS, whose defaults are right", async () => {
    const hosted = "https://api.ace-cms.co.uk";
    const routes: Routes = {};
    for (const [key, route] of Object.entries(friendlyCms())) routes[key.replace(api, hosted)] = route;
    const created = fakeEnvironment(routes, {
      variables: {},
      workingDirectory: root,
      version: "0.6.0",
      templatesDirectory,
    });
    created.store.items[hosted] = { token: "the-token", email: "sam@example.com", expiresAt: "2027-01-01T00:00:00Z" };
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(0);
    expect(bodyOf(created.requests[1]!)).toEqual({ name: "My Shop", domain: "shop.example.com" });
    expect(await exists(join(root, "my-shop", ".env"))).toBe(false);
  });

  it("warns when the login would travel unencrypted to a CMS that isn't on this machine", async () => {
    const remote = "http://cms.example.com";
    const created = fakeEnvironment(
      { [`GET ${remote}/sites`]: () => json({ error: "stop here" }, 500) },
      { variables: { ACE_API_URL: remote }, workingDirectory: root, templatesDirectory },
    );
    created.store.items[remote] = { token: "t", email: "sam@example.com", expiresAt: "2027-01-01T00:00:00Z" };
    await runCli(["create", "my-shop", "shop.example.com"], created.environment);
    expect(created.errors.join("\n")).toContain("is not encrypted");
  });

  it("also takes the domain as --site", async () => {
    const created = setup();
    expect(await runCli(["create", "my-shop", "--site", "shop.example.com"], created.environment)).toBe(0);
    expect(bodyOf(created.requests[1]!).domain).toBe("shop.example.com");
  });

  it("makes a React Router site with the same sections", async () => {
    const created = setup();
    expect(
      await runCli(
        ["create", "shop", "shop.example.com", "--framework", "react-router", "--name", "The Shop"],
        created.environment,
      ),
    ).toBe(0);
    const sectionTypes = created.requests.find((request) => request.address.endsWith("/section-types"))!;
    expect(bodyOf(sectionTypes).sections.map((section: { handle: string }) => section.handle)).toEqual([
      "contact-form",
      "faq",
      "gallery",
      "hero",
    ]);
    const contentType = created.requests.find((request) => request.address.endsWith("/content-types"))!;
    expect(bodyOf(contentType).fields.map((field: { handle: string }) => field.handle)).toContain("content");
    const home = created.requests.find((request) => request.address.endsWith("/entries"))!;
    expect(bodyOf(home).values.content.map((section: { type: string }) => section.type)).toEqual(["hero", "faq"]);
    expect(created.output.join("\n")).toContain("Made The Shop (react-router)");
    expect(await readFile(join(root, "shop", "react-router.config.ts"), "utf8")).toContain("ssr");
    expect(await exists(join(root, "shop", "app/components/sections/hero.schema.ts"))).toBe(true);
  });

  it("leaves a site that already exists alone, says so, and still makes the folder", async () => {
    const created = setup(
      friendlyCms({
        [`GET ${api}/sites`]: () => json([{ id: 9, name: "Shop (live)", domain: "shop.example.com", kind: "real" }]),
      }),
    );
    expect(await runCli(["create", "my-shop", "Shop.Example.com"], created.environment)).toBe(0);
    expect(calls(created)).toEqual(["GET /sites"]);
    expect(created.output.join("\n")).toContain(
      'Warning: shop.example.com already exists in CMS Ace (as "Shop (live)"), so it was left alone',
    );
    expect(await exists(join(root, "my-shop", "package.json"))).toBe(true);
  });

  it("signs you in first when you are not signed in", async () => {
    const created = setup(
      friendlyCms({
        [`POST ${api}/auth/device`]: () =>
          json(
            {
              device_code: "secret",
              user_code: "BCDF-GHJK",
              verification_uri: "http://localhost:5173/device",
              expires_in: 600,
              interval: 5,
            },
            201,
          ),
        [`POST ${api}/auth/device/token`]: () =>
          json({
            status: "approved",
            token: "fresh-token",
            expires_at: "2027-01-11T00:00:00Z",
            user: { email: "sam@example.com" },
          }),
      }),
      { signedIn: false },
    );
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(0);
    expect(created.output.join("\n")).toContain("BCDF-GHJK");
    expect(created.store.items[api]?.token).toBe("fresh-token");
    const makeSite = created.requests.find(
      (request) => request.init?.method === "POST" && request.address.endsWith("/sites"),
    )!;
    expect((makeSite.init?.headers as Record<string, string>).Authorization).toBe("Bearer fresh-token");
    expect(await exists(join(root, "my-shop"))).toBe(true);
  });

  it("makes nothing at all when the CMS refuses to make the site", async () => {
    const created = setup(
      friendlyCms({
        [`POST ${api}/sites`]: () =>
          json({ error: "you have made as many sites as you are allowed (5). Ask for more." }, 403),
      }),
    );
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(1);
    expect(created.errors.join("\n")).toContain("as many sites as you are allowed");
    expect(created.errors.join("\n")).toContain("Nothing was made.");
    expect(await exists(join(root, "my-shop"))).toBe(false);
  });

  it("makes the folder and says the site is half set up when seeding stops part-way", async () => {
    const created = setup(friendlyCms({ [`POST ${api}/sites/7/menus`]: () => json({ error: "no" }, 400) }));
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(1);
    expect(created.errors.join("\n")).toContain("was made in CMS Ace but setting it up stopped: no");
    expect(await exists(join(root, "my-shop", "package.json"))).toBe(true);
  });

  it("asks you to sign in again when the login has ended", async () => {
    const created = setup(friendlyCms({ [`GET ${api}/sites`]: () => json({ error: "unauthorized" }, 401) }));
    expect(await runCli(["create", "my-shop", "shop.example.com"], created.environment)).toBe(1);
    expect(created.errors.join("\n")).toContain("npx ace-kit login");
    expect(await exists(join(root, "my-shop"))).toBe(false);
  });

  it("checks everything it can before it signs in or touches the CMS", async () => {
    for (const commandArguments of [
      ["create", "my-shop", "not a domain"],
      ["create", "my-shop", "shop.example.com", "--name", 'Bad "name"'],
    ]) {
      const created = setup();
      expect(await runCli(commandArguments, created.environment)).toBe(1);
      expect(created.requests).toEqual([]);
    }
    // A folder that already has things in it.
    await runCli(["create", "taken", "taken.example.com"], setup().environment);
    const again = setup();
    expect(await runCli(["create", "taken", "taken.example.com"], again.environment)).toBe(1);
    expect(again.errors.join("\n")).toContain("is not empty");
    expect(again.requests).toEqual([]);
  });

  it.each([
    [["create"], /Give a folder and the site's domain/],
    [["create", "a", "b.com", "c"], /Give a folder and the site's domain/],
    [["create", "a", "b.com", "--site", "c.com"], /Give a folder and the site's domain/],
    [["create", "a"], /Give the site's domain/],
    [["create", "a", "x.com", "--framework", "vue"], /--framework must be astro or react-router/],
  ])("explains a wrong command line %j", async (commandArguments, message) => {
    const created = setup();
    expect(await runCli(commandArguments, created.environment)).toBe(1);
    expect(created.errors.join("\n")).toMatch(message);
    expect(created.requests).toEqual([]);
  });

  it("shows its help", async () => {
    const created = setup();
    expect(await runCli(["create", "--help"], created.environment)).toBe(0);
    expect(created.output.join("\n")).toContain("ace-kit create <folder> <domain>");
  });
});
