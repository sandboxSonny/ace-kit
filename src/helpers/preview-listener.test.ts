// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { listenForPreviewRefresh } from "./preview-listener";

const admin = "http://localhost:5173";
const send = (origin: string, data: unknown) => window.dispatchEvent(new MessageEvent("message", { origin, data }));
const refreshMessage = { type: "cms-ace:refresh" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let stop: (() => void) | undefined;
afterEach(() => stop?.());

describe("listenForPreviewRefresh", () => {
  it("refreshes when the admin app asks", async () => {
    const refresh = vi.fn(async () => undefined);
    stop = listenForPreviewRefresh(admin, refresh);
    send(admin, refreshMessage);
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores everyone else, and other messages", async () => {
    const refresh = vi.fn(async () => undefined);
    stop = listenForPreviewRefresh(admin, refresh);
    send("https://evil.example", refreshMessage);
    send(admin, { type: "other" });
    await settle();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("folds messages that arrive during a refresh into one more refresh", async () => {
    let finish: () => void = () => undefined;
    const refresh = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    stop = listenForPreviewRefresh(admin, refresh);

    send(admin, refreshMessage);
    send(admin, refreshMessage);
    send(admin, refreshMessage);
    expect(refresh).toHaveBeenCalledTimes(1);

    finish();
    await settle();
    expect(refresh).toHaveBeenCalledTimes(2);
    finish();
    await settle();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps listening after a refresh fails, and reports it", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const refresh = vi.fn(async () => Promise.reject(new Error("offline")));
    stop = listenForPreviewRefresh(admin, refresh);
    send(admin, refreshMessage);
    await settle();
    send(admin, refreshMessage);
    await settle();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("stops listening when told to", async () => {
    const refresh = vi.fn(async () => undefined);
    listenForPreviewRefresh(admin, refresh)();
    send(admin, refreshMessage);
    await settle();
    expect(refresh).not.toHaveBeenCalled();
  });
});
