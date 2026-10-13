import { vi } from "vitest";

import type { LoginStore, StoredLogin } from "../auth/login-store";
import type { CliEnvironment } from "./environment";

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

export function memoryStore(
  initial: Record<string, StoredLogin> = {},
): LoginStore & { items: Record<string, StoredLogin> } {
  const items = { ...initial };
  return {
    items,
    description: "the test store",
    read: async (apiUrl) => items[apiUrl] ?? null,
    write: async (apiUrl, login) => {
      items[apiUrl] = login;
    },
    remove: async (apiUrl) => {
      delete items[apiUrl];
    },
  };
}

export type Routes = Record<string, (init?: RequestInit) => Response | Promise<Response>>;

/** An environment where nothing real happens: the CMS is a table of routes, time moves when asked to sleep. */
export function fakeEnvironment(routes: Routes = {}, overrides: Partial<CliEnvironment> = {}) {
  const output: string[] = [];
  const errors: string[] = [];
  const requests: { address: string; init?: RequestInit }[] = [];
  const store = memoryStore();
  let remembered: string | null = null;
  let current = Date.parse("2026-10-13T12:00:00Z");
  const environment: CliEnvironment = {
    variables: {},
    platform: "darwin",
    hostname: "sonnys-macbook",
    version: "0.3.0",
    out: (text) => output.push(text),
    error: (text) => errors.push(text),
    fetchImplementation: async (input, init) => {
      const address = String(input);
      requests.push({ address, init });
      const route = routes[`${init?.method ?? "GET"} ${address}`];
      if (!route) throw new TypeError(`no route for ${init?.method ?? "GET"} ${address}`);
      return route(init);
    },
    sleep: async (milliseconds) => {
      current += milliseconds;
    },
    now: () => current,
    workingDirectory: "/site",
    importModule: async () => {
      throw new Error("no modules in this environment");
    },
    openBrowser: vi.fn(async () => undefined),
    store,
    lastApiUrl: {
      read: async () => remembered,
      write: async (apiUrl) => {
        remembered = apiUrl;
      },
    },
    ...overrides,
  };
  return {
    environment,
    output,
    errors,
    requests,
    store,
    remembered: () => remembered,
    remember: (apiUrl: string) => (remembered = apiUrl),
  };
}
