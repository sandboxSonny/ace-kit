import { describe, expect, it, vi } from "vitest";

import { DeviceLoginError, startDeviceLogin, waitForApproval } from "./device-login";
import type { DeviceLoginRequest } from "./device-login";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const started = {
  device_code: "device-code-secret",
  user_code: "BCDF-GHJK",
  verification_uri: "http://localhost:5173/device",
  expires_in: 600,
  interval: 5,
};

describe("startDeviceLogin", () => {
  it("asks for a login, saying which tool and machine, and reads what it is given", async () => {
    const fetchImplementation = vi.fn(async () => json(started, 201));
    const request = await startDeviceLogin({
      fetchImplementation,
      apiUrl: "http://localhost:8080",
      clientName: "ace-kit 0.3.0 on a Mac",
    });
    expect(request).toEqual({
      deviceCode: "device-code-secret",
      userCode: "BCDF-GHJK",
      verificationUri: "http://localhost:5173/device",
      expiresInSeconds: 600,
      intervalSeconds: 5,
    });
    const [address, init] = fetchImplementation.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toBe("http://localhost:8080/auth/device");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ client_name: "ace-kit 0.3.0 on a Mac" });
  });

  it("never waits less than a second between asks, whatever it is told", async () => {
    const request = await startDeviceLogin({
      fetchImplementation: async () => json({ ...started, interval: 0 }, 201),
      apiUrl: "http://x",
      clientName: "t",
    });
    expect(request.intervalSeconds).toBe(1);
  });

  it("says plainly when the server has no sign-in from the command line", async () => {
    const options = (response: Response) => ({
      fetchImplementation: async () => response,
      apiUrl: "http://x",
      clientName: "t",
    });
    await expect(
      startDeviceLogin(options(json({ error: "signing in from the command line isn't set up on this server" }, 503))),
    ).rejects.toMatchObject({
      reason: "unsupported",
      message: "signing in from the command line isn't set up on this server",
    });
    await expect(startDeviceLogin(options(json({}, 404)))).rejects.toMatchObject({
      reason: "unsupported",
      message: expect.stringContaining("does not offer command-line sign-in"),
    });
  });

  it("says when to wait, when the server can't be reached, and when it answers with something unreadable", async () => {
    const options = (fetchImplementation: typeof fetch) => ({
      fetchImplementation,
      apiUrl: "http://x",
      clientName: "t",
    });
    await expect(startDeviceLogin(options(async () => json({}, 429)))).rejects.toMatchObject({
      reason: "unavailable",
      message: expect.stringContaining("Wait a minute"),
    });
    await expect(
      startDeviceLogin(options(async () => Promise.reject(new TypeError("fetch failed")))),
    ).rejects.toMatchObject({ reason: "unavailable", message: "Could not reach the CMS at http://x." });
    await expect(startDeviceLogin(options(async () => json({ error: "boom" }, 500)))).rejects.toMatchObject({
      reason: "unavailable",
      message: "boom",
    });
    await expect(startDeviceLogin(options(async () => json({ device_code: "x" }, 201)))).rejects.toMatchObject({
      reason: "unavailable",
      message: expect.stringContaining("Update ace-kit"),
    });
    await expect(startDeviceLogin(options(async () => new Response("<html>", { status: 201 })))).rejects.toBeInstanceOf(
      DeviceLoginError,
    );
  });
});

/** A clock and a sleep that move together, so waiting costs nothing. */
function fakeTime() {
  let current = 1_000_000;
  const waits: number[] = [];
  return {
    now: () => current,
    sleep: async (milliseconds: number) => {
      waits.push(milliseconds);
      current += milliseconds;
    },
    waits,
  };
}

const request: DeviceLoginRequest = {
  deviceCode: "device-code-secret",
  userCode: "BCDF-GHJK",
  verificationUri: "http://x/device",
  expiresInSeconds: 600,
  intervalSeconds: 5,
};
const approved = {
  status: "approved",
  token: "the-session-token",
  expires_at: "2027-01-11T00:00:00Z",
  user: { email: "sam@example.com" },
};

/** Answers each ask in turn with the next reply. */
function replies(...answers: (Response | Error)[]) {
  const queue = [...answers];
  return vi.fn(async (): Promise<Response> => {
    const next = queue.shift();
    if (!next) throw new Error("asked more often than the test expected");
    if (next instanceof Error) throw next;
    return next;
  });
}

describe("waitForApproval", () => {
  const run = (fetchImplementation: typeof fetch, time = fakeTime(), override: Partial<DeviceLoginRequest> = {}) =>
    waitForApproval({
      fetchImplementation,
      apiUrl: "http://localhost:8080",
      request: { ...request, ...override },
      sleep: time.sleep,
      now: time.now,
    });

  it("asks with the device code, at the pace it was told, and returns the login once approved", async () => {
    const time = fakeTime();
    const fetchImplementation = replies(json({ status: "pending" }), json({ status: "pending" }), json(approved));
    const login = await run(fetchImplementation as unknown as typeof fetch, time);
    expect(login).toEqual({ token: "the-session-token", expiresAt: "2027-01-11T00:00:00Z", email: "sam@example.com" });
    expect(time.waits).toEqual([5000, 5000, 5000]);
    const [address, init] = fetchImplementation.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toBe("http://localhost:8080/auth/device/token");
    expect(JSON.parse(String(init.body))).toEqual({ device_code: "device-code-secret" });
  });

  it("waits longer each time it is told to slow down", async () => {
    const time = fakeTime();
    await run(
      replies(
        json({ status: "slow_down", interval: 5 }),
        json({ status: "slow_down" }),
        json(approved),
      ) as unknown as typeof fetch,
      time,
    );
    expect(time.waits).toEqual([5000, 10_000, 15_000]);
  });

  it("waits longer when it is told off for asking too often", async () => {
    const time = fakeTime();
    await run(replies(json({}, 429), json(approved)) as unknown as typeof fetch, time);
    expect(time.waits).toEqual([5000, 10_000]);
  });

  it("stops when the login is turned down", async () => {
    await expect(
      run(replies(json({ status: "pending" }), json({ status: "denied" })) as unknown as typeof fetch),
    ).rejects.toMatchObject({ reason: "denied" });
  });

  it("stops when the code has expired, or the CMS no longer knows it", async () => {
    await expect(run(replies(json({ status: "expired" })) as unknown as typeof fetch)).rejects.toMatchObject({
      reason: "expired",
    });
    await expect(
      run(replies(json({ error: "unknown device code" }, 404)) as unknown as typeof fetch),
    ).rejects.toMatchObject({ reason: "expired" });
  });

  it("gives up when the time the code lasts has passed, without asking again", async () => {
    const time = fakeTime();
    const fetchImplementation = replies(...Array.from({ length: 200 }, () => json({ status: "pending" })));
    await expect(
      run(fetchImplementation as unknown as typeof fetch, time, { expiresInSeconds: 12 }),
    ).rejects.toMatchObject({ reason: "expired" });
    // 5s, 10s: two asks; at 15s it is past the 12s and stops.
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("puts up with a few failed asks in a row, then carries on", async () => {
    const down = new TypeError("fetch failed");
    const fetchImplementation = replies(
      down,
      down,
      down,
      down,
      json({ status: "pending" }),
      down,
      down,
      down,
      down,
      json(approved),
    );
    expect((await run(fetchImplementation as unknown as typeof fetch)).token).toBe("the-session-token");
  });

  it("gives up after five failed asks in a row", async () => {
    const down = new TypeError("fetch failed");
    await expect(run(replies(down, down, down, down, down) as unknown as typeof fetch)).rejects.toMatchObject({
      reason: "unavailable",
    });
    await expect(
      run(
        replies(
          json({ error: "bad" }, 500),
          json({}, 500),
          json({}, 502),
          json({}, 503),
          json({ error: "last" }, 500),
        ) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({
      reason: "unavailable",
      message: "last",
    });
  });

  it("refuses an approval it can't read, rather than storing something half-formed", async () => {
    for (const body of [
      { status: "approved" },
      { status: "approved", token: "t" },
      { status: "approved", token: "t", expires_at: "x", user: {} },
      { status: "approved", token: 5, expires_at: "x", user: { email: "a" } },
    ]) {
      await expect(run(replies(json(body)) as unknown as typeof fetch), JSON.stringify(body)).rejects.toMatchObject({
        reason: "unavailable",
      });
    }
    await expect(run(replies(json({ status: "something new" })) as unknown as typeof fetch)).rejects.toMatchObject({
      reason: "unavailable",
      message: expect.stringContaining("Update ace-kit"),
    });
  });

  it("never puts the token or the device code in an error", async () => {
    const outcomes = await Promise.allSettled([
      run(replies(json({ status: "denied" })) as unknown as typeof fetch),
      run(replies(json({ status: "expired" })) as unknown as typeof fetch),
      run(replies(json({}, 404)) as unknown as typeof fetch),
      run(replies(json({ status: "approved", token: "the-session-token" })) as unknown as typeof fetch),
    ]);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe("rejected");
      const message = String((outcome as PromiseRejectedResult).reason?.message);
      expect(message).not.toContain("the-session-token");
      expect(message).not.toContain("device-code-secret");
    }
  });
});
