import { describe, expect, it, vi } from "vitest";

import { AcePreviewExpiredError, AceUnavailableError } from "./errors";
import { createAceClient, environmentFromProcess, maximumCachedAnswers } from "./create-client";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const entry = { id: 1, content_type_handle: "pages", handle: "home", title: "Home", values: { headline: "Hi" } };

function clientWith(fetchImplementation: typeof fetch, extra: { cacheSeconds?: number; now?: () => number } = {}) {
  return createAceClient({
    apiUrl: "https://api.example.com/",
    siteDomain: "example.test",
    fetchImplementation,
    ...extra,
  });
}

describe("getEntry", () => {
  it("asks the API for the entry as the site's domain", async () => {
    const fetchSpy = vi.fn(async () => json(entry));
    const found = await clientWith(fetchSpy as unknown as typeof fetch).getEntry("pages", "home");

    expect(found).toEqual(entry);
    const [address, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toBe("https://api.example.com/public/entries/home");
    expect((init.headers as Record<string, string>)["X-Ace-Site-Domain"]).toBe("example.test");
    expect((init.headers as Record<string, string>)["X-Forwarded-Host"]).toBe("example.test");
  });

  it("escapes the handle", async () => {
    const fetchSpy = vi.fn(async () => json(entry));
    await clientWith(fetchSpy as unknown as typeof fetch).getEntry("pages", "a/b");
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toContain("/public/entries/a%2Fb");
  });

  it("returns null when the site has no such entry", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "entry not found" }, 404));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getEntry("pages", "nope")).toBeNull();
  });

  it("reports a site that isn't set up in the CMS, rather than a missing page", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "no site for this domain" }, 404));
    await expect(clientWith(fetchSpy as unknown as typeof fetch).getEntry("pages", "home")).rejects.toThrow(
      'no site with the domain "example.test"',
    );
  });

  it("reports an unreachable or failing CMS", async () => {
    const down = vi.fn(async () => Promise.reject(new TypeError("fetch failed")));
    await expect(clientWith(down as unknown as typeof fetch).getEntry("pages", "home")).rejects.toBeInstanceOf(
      AceUnavailableError,
    );
    const broken = vi.fn(async () => json({ error: "boom" }, 500));
    await expect(clientWith(broken as unknown as typeof fetch).getEntry("pages", "home")).rejects.toThrow(
      "error (500)",
    );
    const garbage = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(clientWith(garbage as unknown as typeof fetch).getEntry("pages", "home")).rejects.toThrow(
      "could not be read",
    );
  });
});

describe("the environment", () => {
  it("tells the CMS whether this is the production website, so a site being built launches on its first real read", async () => {
    const fetchSpy = vi.fn(async () => json(entry));
    await createAceClient({
      apiUrl: "https://api.example.com",
      siteDomain: "example.test",
      environment: "production",
      fetchImplementation: fetchSpy as unknown as typeof fetch,
    }).getEntry("pages", "home");
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Ace-Environment"]).toBe("production");
  });

  it("works it out from the process when the site doesn't say", () => {
    const saved = { ...process.env };
    try {
      process.env.ACE_ENVIRONMENT = "production";
      expect(environmentFromProcess()).toBe("production");
      delete process.env.ACE_ENVIRONMENT;
      expect(environmentFromProcess()).toBe("development"); // a test run
      delete process.env.VITEST;
      process.env.NODE_ENV = "development";
      expect(environmentFromProcess()).toBe("development");
      process.env.NODE_ENV = "production";
      expect(environmentFromProcess()).toBe("production");
      delete process.env.NODE_ENV;
      expect(environmentFromProcess()).toBe("production"); // a deployed server that sets nothing
    } finally {
      for (const name of ["ACE_ENVIRONMENT", "VITEST", "NODE_ENV"]) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    }
  });
});

describe("getEntry and the content type", () => {
  it("is null when the entry belongs to another content type, because handles are unique across a site", async () => {
    const fetchSpy = vi.fn(async () => json(entry));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getEntry("posts", "home")).toBeNull();
  });
});

describe("getEntries", () => {
  it("asks for one content type's entries, with a limit", async () => {
    const fetchSpy = vi.fn(async () => json([entry]));
    const entries = await clientWith(fetchSpy as unknown as typeof fetch).getEntries("pages", { limit: 10 });
    expect(entries).toEqual([entry]);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe(
      "https://api.example.com/public/entries?content_type=pages&limit=10",
    );
  });

  it("reports a site that isn't set up in the CMS", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "no site for this domain" }, 404).clone());
    await expect(clientWith(fetchSpy as unknown as typeof fetch).getEntries("pages")).rejects.toBeInstanceOf(
      AceUnavailableError,
    );
  });
});

describe("getContentTypes", () => {
  it("reads what the site's content types look like", async () => {
    const schema = [{ handle: "pages", name: "Pages", fields: [] }];
    const fetchSpy = vi.fn(async () => json(schema));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getContentTypes()).toEqual(schema);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://api.example.com/public/content-types");
  });
});

describe("caching", () => {
  it("reuses an answer briefly, then asks again", async () => {
    let time = 0;
    const fetchSpy = vi.fn(async () => json(entry));
    const client = clientWith(fetchSpy as unknown as typeof fetch, { cacheSeconds: 5, now: () => time });

    await client.getEntry("pages", "home");
    time = 4000;
    await client.getEntry("pages", "home");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    time = 5001;
    await client.getEntry("pages", "home");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("also remembers that an entry doesn't exist", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "entry not found" }, 404));
    const client = clientWith(fetchSpy as unknown as typeof fetch);
    await client.getEntry("pages", "nope");
    await client.getEntry("pages", "nope");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("never remembers a failure", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "boom" }, 500));
    const client = clientWith(fetchSpy as unknown as typeof fetch);
    await client.getEntry("pages", "home").catch(() => undefined);
    await client.getEntry("pages", "home").catch(() => undefined);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("can be turned off", async () => {
    const fetchSpy = vi.fn(async () => json(entry));
    const client = clientWith(fetchSpy as unknown as typeof fetch, { cacheSeconds: 0 });
    await client.getEntry("pages", "home");
    await client.getEntry("pages", "home");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("the cache is bounded", () => {
  it("can't be filled without limit by asking for a lot of different entries", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "entry not found" }, 404));
    const client = clientWith(fetchSpy as unknown as typeof fetch, { cacheSeconds: 60, now: () => 0 });

    for (let index = 0; index <= maximumCachedAnswers + 100; index++) await client.getEntry("pages", `entry-${index}`);
    const calls = fetchSpy.mock.calls.length;

    // The newest answers are still remembered...
    await client.getEntry("pages", `entry-${maximumCachedAnswers + 100}`);
    expect(fetchSpy.mock.calls.length).toBe(calls);
    // ...and the oldest were forgotten to make room.
    await client.getEntry("pages", "entry-0");
    expect(fetchSpy.mock.calls.length).toBe(calls + 1);
  });

  it("forgets answers that have run out before it forgets any that haven't", async () => {
    let time = 0;
    const fetchSpy = vi.fn(async () => json(entry));
    const client = clientWith(fetchSpy as unknown as typeof fetch, { cacheSeconds: 5, now: () => time });
    await client.getEntry("pages", "old");
    time = 1000;
    for (let index = 0; index < maximumCachedAnswers - 1; index++) await client.getEntry("pages", `entry-${index}`);
    time = 5500; // "old" (stored at 0) has run out; the others (stored at 1000) have not
    await client.getEntry("pages", "one-more");
    const calls = fetchSpy.mock.calls.length;
    await client.getEntry("pages", "entry-0");
    expect(fetchSpy.mock.calls.length).toBe(calls);
  });
});

describe("previews", () => {
  it("sends the token, shows the draft and never caches it", async () => {
    const draft = { ...entry, title: "Draft", is_draft: true };
    const fetchSpy = vi.fn(async () => json(draft));
    const client = clientWith(fetchSpy as unknown as typeof fetch);

    const found = await client.getEntry("pages", "home", { previewToken: "tok en" });
    await client.getEntry("pages", "home", { previewToken: "tok en" });

    expect(found).toEqual(draft);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe(
      "https://api.example.com/public/entries/home?preview=tok%20en",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not let a draft into the cache that live visitors use", async () => {
    const fetchSpy = vi.fn(async (address: string) =>
      json(address.includes("preview=") ? { ...entry, title: "Draft" } : entry),
    );
    const client = clientWith(fetchSpy as unknown as typeof fetch);

    await client.getEntry("pages", "home", { previewToken: "tok" });
    const live = await client.getEntry("pages", "home");

    expect((live as { title: string }).title).toBe("Home");
  });

  it("reports a token that has run out", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "preview link is invalid or has expired" }, 403));
    await expect(
      clientWith(fetchSpy as unknown as typeof fetch).getEntry("pages", "home", { previewToken: "old" }),
    ).rejects.toBeInstanceOf(AcePreviewExpiredError);
  });

  it("treats a missing or empty token as no preview", async () => {
    const fetchSpy = vi.fn(async () => json(entry));
    const client = clientWith(fetchSpy as unknown as typeof fetch, { cacheSeconds: 0 });
    await client.getEntry("pages", "home", { previewToken: null });
    await client.getEntry("pages", "home", { previewToken: "" });
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://api.example.com/public/entries/home");
    expect((fetchSpy.mock.calls[1] as unknown[])[0]).toBe("https://api.example.com/public/entries/home");
  });
});

describe("getRedirect", () => {
  const redirect = { from: "/old", to: "/pages/new", status: 301 };
  const ask = (answer: unknown, status = 200) => {
    const fetchSpy = vi.fn(async () => json(answer, status));
    return { fetchSpy, client: clientWith(fetchSpy as unknown as typeof fetch) };
  };

  it("asks for the address, query string and all", async () => {
    const { fetchSpy, client } = ask(redirect);
    expect(await client.getRedirect("/old?id=7&a=b")).toEqual(redirect);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe(
      "https://api.example.com/public/redirects?from=%2Fold%3Fid%3D7%26a%3Db",
    );
  });

  it("returns null when the site has no redirect for it", async () => {
    expect(await ask({ error: "redirect not found" }, 404).client.getRedirect("/old")).toBeNull();
  });

  it("only follows a path on the site or a web address, whatever the CMS says", async () => {
    for (const to of ["//evil.test", "javascript:alert(1)", "/a\\evil", "ftp://x.test", "https://", ""]) {
      expect(await ask({ ...redirect, to }).client.getRedirect("/old"), to).toBeNull();
    }
    expect(await ask({ ...redirect, status: 307 }).client.getRedirect("/old")).toBeNull();
    expect(await ask({ ...redirect, to: "https://shop.example.com/x" }).client.getRedirect("/old")).not.toBeNull();
  });
});

describe("getSitemap", () => {
  it("asks for the site's pages, and treats none as an empty list", async () => {
    const pages = [{ path: "/", updated_at: "2026-10-16T10:00:00Z" }];
    const fetchSpy = vi.fn(async () => json(pages));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getSitemap()).toEqual(pages);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://api.example.com/public/sitemap");
    const missing = vi.fn(async () => json({ error: "not found" }, 404));
    expect(await clientWith(missing as unknown as typeof fetch).getSitemap()).toEqual([]);
  });
});

describe("getSite", () => {
  it("asks for the site, with its social image", async () => {
    const site = { id: 1, name: "Acme", domain: "acme.test", handle: "acme", social_image: null, favicon: null };
    const fetchSpy = vi.fn(async () => json(site));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getSite()).toEqual(site);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://api.example.com/public/site");
  });
});

describe("getMenu", () => {
  it("asks for the menu by its handle", async () => {
    const menu = { name: "Main menu", handle: "main-menu", items: [] };
    const fetchSpy = vi.fn(async () => json(menu));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getMenu("main-menu")).toEqual(menu);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://api.example.com/public/menus/main-menu");
  });

  it("returns null when the site has no such menu", async () => {
    const fetchSpy = vi.fn(async () => json({ error: "menu not found" }, 404));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getMenu("nope")).toBeNull();
  });
});

describe("forms", () => {
  const settings = { handle: "contact", name: "Contact", fields: [], thank_you: "Thanks!", turnstile_site_key: "" };

  it("reads a form by its handle, and says null when the site has none", async () => {
    const fetchSpy = vi.fn(async () => json(settings));
    expect(await clientWith(fetchSpy as unknown as typeof fetch).getForm("contact")).toEqual(settings);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://api.example.com/public/forms/contact");
    const missing = vi.fn(async () => json({ error: "not found" }, 404));
    expect(await clientWith(missing as unknown as typeof fetch).getForm("nope")).toBeNull();
  });

  it("sends what a visitor filled in, as the site's domain, and returns the thank-you", async () => {
    const fetchSpy = vi.fn(async () => json({ message: "Thanks!" }, 201));
    const result = await clientWith(fetchSpy as unknown as typeof fetch).submitForm("contact", {
      values: { name: "Vic", updates: true },
      turnstileToken: "tok",
    });
    expect(result).toEqual({ ok: true, message: "Thanks!" });
    const [address, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toBe("https://api.example.com/public/forms/contact/submissions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Ace-Site-Domain"]).toBe("example.test");
    expect(JSON.parse(String(init.body))).toEqual({
      values: { name: "Vic", updates: true },
      honeypot: "",
      turnstile_token: "tok",
    });
  });

  it("is never answered from the cache: each send goes to the CMS", async () => {
    const fetchSpy = vi.fn(async () => json({ message: "Thanks!" }, 201));
    const client = clientWith(fetchSpy as unknown as typeof fetch, { cacheSeconds: 60 });
    await client.submitForm("contact", { values: {} });
    await client.submitForm("contact", { values: {} });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns a refusal the visitor can act on in the CMS's words, and anything else as a plain apology", async () => {
    const refused = (status: number, error: string) =>
      clientWith((async () => json({ error }, status)) as unknown as typeof fetch).submitForm("contact", {
        values: {},
      });
    expect(await refused(400, "Name is required")).toEqual({ ok: false, status: 400, error: "Name is required" });
    expect(await refused(429, "this form has had a lot of messages")).toMatchObject({ ok: false, status: 429 });
    expect(await refused(500, "internal error")).toEqual({
      ok: false,
      status: 500,
      error: "Something went wrong sending that. Please try again.",
    });
  });

  it("throws when the CMS can't be reached", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(
      clientWith(fetchSpy as unknown as typeof fetch).submitForm("contact", { values: {} }),
    ).rejects.toBeInstanceOf(AceUnavailableError);
  });
});
