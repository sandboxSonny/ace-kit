import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { browserCommand } from "./environment";
import { fakeEnvironment, json } from "./fake-environment";
import type { Routes } from "./fake-environment";
import { runCli } from "./main";

const api = "http://localhost:8080";
const started = {
  device_code: "device-code-secret",
  user_code: "BCDF-GHJK",
  verification_uri: "http://localhost:5173/device",
  expires_in: 600,
  interval: 5,
};
const approved = {
  status: "approved",
  token: "the-session-token",
  expires_at: "2027-01-11T00:00:00Z",
  user: { email: "sam@example.com" },
};

const loginRoutes = (...polls: unknown[]): Routes => {
  const queue = [...polls];
  return {
    [`POST ${api}/auth/device`]: () => json(started, 201),
    [`POST ${api}/auth/device/token`]: () => json(queue.shift() ?? approved),
  };
};

describe("ace-kit login", () => {
  it("shows the code and the page, opens the page, waits for approval and keeps the login", async () => {
    const { environment, output, errors, requests, store } = fakeEnvironment(
      loginRoutes({ status: "pending" }, approved),
    );
    expect(await runCli(["login", "--api-url", api], environment)).toBe(0);

    const shown = output.join("\n");
    expect(shown).toContain(`Signing in to ${api}`);
    expect(shown).toContain("http://localhost:5173/device");
    expect(shown).toContain("BCDF-GHJK");
    expect(shown).toContain("Signed in as sam@example.com");
    expect(shown).toContain("kept in the test store");
    expect(environment.openBrowser).toHaveBeenCalledWith("http://localhost:5173/device");
    expect(store.items[api]).toEqual({
      token: "the-session-token",
      expiresAt: "2027-01-11T00:00:00Z",
      email: "sam@example.com",
    });
    expect(errors).toEqual([]);

    // It said which tool and machine, for the person approving.
    const asking = JSON.parse(String(requests[0].init?.body));
    expect(asking).toEqual({ client_name: "ace-kit 0.3.0 on sonnys-macbook" });
  });

  it("never prints the token or the secret device code", async () => {
    const { environment, output, errors } = fakeEnvironment(loginRoutes(approved));
    await runCli(["login", "--api-url", api], environment);
    for (const line of [...output, ...errors]) {
      expect(line).not.toContain("the-session-token");
      expect(line).not.toContain("device-code-secret");
    }
  });

  it("takes the API address from ACE_API_URL, written any way", async () => {
    const { environment, store } = fakeEnvironment(loginRoutes(approved), {
      variables: { ACE_API_URL: "HTTP://localhost:8080/" },
    });
    expect(await runCli(["login"], environment)).toBe(0);
    expect(Object.keys(store.items)).toEqual([api]);
  });

  it("says what is missing or wrong with the address", async () => {
    const missing = fakeEnvironment();
    expect(await runCli(["login"], missing.environment)).toBe(1);
    expect(missing.errors.join()).toContain("Give the API address");
    const wrong = fakeEnvironment();
    expect(await runCli(["login", "--api-url", "ftp://example.com"], wrong.environment)).toBe(1);
    expect(wrong.errors.join()).toContain("must start with http:// or https://");
    expect(wrong.requests).toEqual([]);
  });

  it("does not open an approval address that isn't a web address", async () => {
    const routes = loginRoutes();
    routes[`POST ${api}/auth/device`] = () => json({ ...started, verification_uri: "file:///etc/passwd" }, 201);
    const { environment, errors, store } = fakeEnvironment(routes);
    expect(await runCli(["login", "--api-url", api], environment)).toBe(1);
    expect(environment.openBrowser).not.toHaveBeenCalled();
    expect(errors.join()).toContain("isn't a web address");
    expect(store.items).toEqual({});
  });

  it("carries on if the browser can't be opened, since the address is on the screen", async () => {
    const { environment, output } = fakeEnvironment(loginRoutes(approved), {
      openBrowser: async () => Promise.reject(new Error("no browser")),
    });
    expect(await runCli(["login", "--api-url", api], environment)).toBe(0);
    expect(output.join("\n")).toContain("http://localhost:5173/device");
  });

  it("keeps nothing and says so when the login is turned down", async () => {
    const { environment, errors, store } = fakeEnvironment(loginRoutes({ status: "denied" }));
    expect(await runCli(["login", "--api-url", api], environment)).toBe(1);
    expect(errors.join()).toContain("turned down");
    expect(store.items).toEqual({});
  });

  it("warns about an unencrypted address that isn't this machine, and only then", async () => {
    const remote = fakeEnvironment({ "POST http://cms.example.com/auth/device": () => json({}, 503) });
    await runCli(["login", "--api-url", "http://cms.example.com"], remote.environment);
    expect(remote.errors.join()).toContain("is not encrypted");
    for (const address of ["http://localhost:8080", "http://127.0.0.1:8080", "https://api.example.com"]) {
      const quiet = fakeEnvironment({ [`POST ${address}/auth/device`]: () => json({}, 503) });
      await runCli(["login", "--api-url", address], quiet.environment);
      expect(quiet.errors.join(), address).not.toContain("is not encrypted");
    }
  });

  it("explains a server that can't do it", async () => {
    const { environment, errors } = fakeEnvironment({
      [`POST ${api}/auth/device`]: () =>
        json({ error: "signing in from the command line isn't set up on this server" }, 503),
    });
    expect(await runCli(["login", "--api-url", api], environment)).toBe(1);
    expect(errors.join()).toContain("isn't set up on this server");
  });
});

describe("remembering the API address", () => {
  it("remembers the address a login was made to, and whoami and logout use it with no address given", async () => {
    const { environment, output, remembered } = fakeEnvironment({
      ...loginRoutes(approved),
      [`GET ${api}/auth/me`]: () => json({ email: "sam@example.com" }),
      [`POST ${api}/auth/logout`]: () => new Response(null, { status: 204 }),
    });
    expect(await runCli(["login", "--api-url", "HTTP://localhost:8080/"], environment)).toBe(0);
    expect(remembered()).toBe(api);

    expect(await runCli(["whoami"], environment)).toBe(0);
    expect(output.join("\n")).toContain(`Signed in to ${api} as sam@example.com`);
    expect(await runCli(["logout"], environment)).toBe(0);
    expect(output.join("\n")).toContain(`Signed out of ${api}.`);
  });

  it("lets login use it too, to sign in again", async () => {
    const { environment, remember, store } = fakeEnvironment(loginRoutes(approved));
    remember(api);
    expect(await runCli(["login"], environment)).toBe(0);
    expect(Object.keys(store.items)).toEqual([api]);
  });

  it("prefers an address that is given: first --api-url, then ACE_API_URL, then the remembered one", async () => {
    const other = "http://localhost:9090";
    const routes: Routes = { [`GET ${other}/auth/me`]: () => json({ email: "other@example.com" }) };
    const first = fakeEnvironment(routes, { variables: { ACE_API_URL: "http://localhost:1111" } });
    first.remember(api);
    first.store.items[other] = { token: "t", email: "other@example.com", expiresAt: "2027-01-01T00:00:00Z" };
    expect(await runCli(["whoami", "--api-url", other], first.environment)).toBe(0);
    expect(first.requests[0].address).toBe(`${other}/auth/me`);

    const second = fakeEnvironment({}, { variables: { ACE_API_URL: other } });
    second.remember(api);
    second.store.items[other] = { token: "t", email: "other@example.com", expiresAt: "2027-01-01T00:00:00Z" };
    second.environment.fetchImplementation = async (input) => {
      second.requests.push({ address: String(input) });
      return json({ email: "other@example.com" });
    };
    await runCli(["whoami"], second.environment);
    expect(second.requests[0].address).toBe(`${other}/auth/me`);
  });

  it("does not remember an address when the login failed", async () => {
    const { environment, remembered } = fakeEnvironment(loginRoutes({ status: "denied" }));
    await runCli(["login", "--api-url", api], environment);
    expect(remembered()).toBeNull();
  });

  it("still signs in when the address can't be remembered", async () => {
    const { environment, store } = fakeEnvironment(loginRoutes(approved), {
      lastApiUrl: { read: async () => null, write: async () => Promise.reject(new Error("read-only disk")) },
    });
    expect(await runCli(["login", "--api-url", api], environment)).toBe(0);
    expect(store.items[api]?.token).toBe("the-session-token");
  });
});

describe("ace-kit logout", () => {
  const stored = { token: "stored-token", expiresAt: "2027-01-01T00:00:00Z", email: "sam@example.com" };

  it("ends the login at the CMS as well as forgetting it here", async () => {
    const { environment, output, requests, store } = fakeEnvironment({
      [`POST ${api}/auth/logout`]: () => new Response(null, { status: 204 }),
    });
    store.items[api] = stored;
    expect(await runCli(["logout", "--api-url", api], environment)).toBe(0);
    expect(store.items).toEqual({});
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer stored-token");
    expect(output.join()).toBe(`Signed out of ${api}.`);
  });

  it("forgets the login even when the CMS can't be reached, and says it could not end it there", async () => {
    const { environment, output, store } = fakeEnvironment({});
    store.items[api] = stored;
    expect(await runCli(["logout", "--api-url", api], environment)).toBe(0);
    expect(store.items).toEqual({});
    expect(output.join()).toContain("could not reach the CMS to end it there");
    expect(output.join()).not.toContain("stored-token");
  });

  it("treats a login the CMS has already ended as signed out", async () => {
    const { environment, output, store } = fakeEnvironment({ [`POST ${api}/auth/logout`]: () => json({}, 401) });
    store.items[api] = stored;
    await runCli(["logout", "--api-url", api], environment);
    expect(output.join()).toBe(`Signed out of ${api}.`);
  });

  it("says so when there was no login", async () => {
    const { environment, output } = fakeEnvironment();
    expect(await runCli(["logout", "--api-url", api], environment)).toBe(0);
    expect(output.join()).toBe(`Not signed in to ${api}.`);
  });
});

describe("ace-kit whoami", () => {
  const stored = { token: "stored-token", expiresAt: "2027-01-01T00:00:00Z", email: "sam@example.com" };
  const me = (status = 200) => ({ [`GET ${api}/auth/me`]: () => json({ email: "sam@example.com" }, status) });

  it("says who the stored login is for, and where it is kept", async () => {
    const { environment, output, requests, store } = fakeEnvironment(me());
    store.items[api] = stored;
    expect(await runCli(["whoami", "--api-url", api], environment)).toBe(0);
    expect(output.join()).toBe(`Signed in to ${api} as sam@example.com, using the login in the test store.`);
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer stored-token");
  });

  it("uses ACE_TOKEN when it is set", async () => {
    const { environment, output, requests } = fakeEnvironment(me(), { variables: { ACE_TOKEN: "ci-token" } });
    expect(await runCli(["whoami", "--api-url", api], environment)).toBe(0);
    expect(output.join()).toContain("the ACE_TOKEN setting");
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer ci-token");
  });

  it("says to sign in when there is no login, or it has run out, without asking the CMS", async () => {
    const none = fakeEnvironment(me());
    expect(await runCli(["whoami", "--api-url", api], none.environment)).toBe(1);
    expect(none.output.join()).toContain("Run: ace-kit login");
    const old = fakeEnvironment(me());
    old.store.items[api] = { ...stored, expiresAt: "2026-10-01T00:00:00Z" };
    expect(await runCli(["whoami", "--api-url", api], old.environment)).toBe(1);
    expect(none.requests).toEqual([]);
    expect(old.requests).toEqual([]);
  });

  it("says when the CMS has ended the login", async () => {
    const { environment, output, store } = fakeEnvironment(me(401));
    store.items[api] = stored;
    expect(await runCli(["whoami", "--api-url", api], environment)).toBe(1);
    expect(output.join()).toContain("has ended. Run: ace-kit login");
  });

  it("says when the CMS can't be reached or is in trouble", async () => {
    const down = fakeEnvironment({});
    down.store.items[api] = stored;
    expect(await runCli(["whoami", "--api-url", api], down.environment)).toBe(1);
    expect(down.errors.join()).toContain("Could not reach the CMS");
    const broken = fakeEnvironment(me(500));
    broken.store.items[api] = stored;
    expect(await runCli(["whoami", "--api-url", api], broken.environment)).toBe(1);
    expect(broken.errors.join()).toContain("(500)");
  });
});

describe("ace-kit", () => {
  it("lists its commands when asked, or given nothing", async () => {
    const asked = fakeEnvironment();
    expect(await runCli(["--help"], asked.environment)).toBe(0);
    for (const command of ["generate", "login", "logout", "whoami"])
      expect(asked.output.join()).toContain(`ace-kit ${command}`);
    const nothing = fakeEnvironment();
    expect(await runCli([], nothing.environment)).toBe(1);
  });

  it("refuses a command it doesn't have", async () => {
    const { environment, errors } = fakeEnvironment();
    expect(await runCli(["deploy"], environment)).toBe(1);
    expect(errors.join()).toContain('Unknown command "deploy"');
  });

  it("shows each command's help without doing anything", async () => {
    for (const command of ["generate", "login", "logout", "whoami"]) {
      const { environment, output, requests } = fakeEnvironment();
      expect(await runCli([command, "--help"], environment), command).toBe(0);
      expect(output.join()).toContain("--api-url");
      expect(requests).toEqual([]);
    }
  });
});

describe("ace-kit generate (still works as before)", () => {
  let folder: string;
  afterEach(async () => {
    if (folder) await rm(folder, { recursive: true, force: true });
  });

  it("writes the types for the site's content types", async () => {
    folder = await mkdtemp(join(tmpdir(), "ace-kit-generate-"));
    const out = join(folder, "types.d.ts");
    const { environment, output, requests } = fakeEnvironment({
      [`GET ${api}/public/content-types`]: () =>
        json([
          {
            handle: "pages",
            name: "Pages",
            fields: [{ handle: "headline", label: "Headline", component_key: "text", config: { required: true } }],
          },
        ]),
    });
    expect(await runCli(["generate", "--api-url", api, "--domain", "example.test", "--out", out], environment)).toBe(0);
    expect(await readFile(out, "utf8")).toContain('"headline": string;');
    expect(output.join()).toContain("Wrote types for 1 content type");
    const headers = requests[0].init?.headers as Record<string, string>;
    expect(headers["X-Ace-Site-Domain"]).toBe("example.test");
  });

  it("asks for the settings it needs", async () => {
    const { environment, errors } = fakeEnvironment();
    expect(await runCli(["generate"], environment)).toBe(1);
    expect(errors.join()).toContain("--api-url and --domain");
  });
});

describe("browserCommand", () => {
  it("opens a page with the program each system has", () => {
    expect(browserCommand("darwin", "http://x")).toEqual({ command: "open", commandArguments: ["http://x"] });
    expect(browserCommand("linux", "http://x")).toEqual({ command: "xdg-open", commandArguments: ["http://x"] });
    expect(browserCommand("win32", "http://x")).toEqual({
      command: "rundll32",
      commandArguments: ["url.dll,FileProtocolHandler", "http://x"],
    });
  });

  it("never opens an address through a shell, where a character like & would be a command", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      const { command, commandArguments } = browserCommand(platform, "http://x/?a=1&b=2");
      expect(command, platform).not.toMatch(/^(cmd|sh|bash|zsh|powershell)$/);
      expect(commandArguments, platform).toContain("http://x/?a=1&b=2");
    }
  });
});
