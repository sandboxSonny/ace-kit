// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AceTurnstile } from "./ace-turnstile";

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

function fakeTurnstile() {
  const api = {
    render: vi.fn((_element: HTMLElement, _options: unknown) => "widget-1"),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = api;
  return api;
}

describe("AceTurnstile", () => {
  it("draws nothing without a site key", () => {
    const { container } = render(<AceTurnstile siteKey="" />);
    expect(container.innerHTML).toBe("");
    const none = render(<AceTurnstile siteKey={undefined} />);
    expect(none.container.innerHTML).toBe("");
  });

  it("draws the widget itself with the site key, and passes on the token, clearing it when it runs out", async () => {
    const api = fakeTurnstile();
    const onToken = vi.fn();
    const { container } = render(<AceTurnstile siteKey="0xSITE" onToken={onToken} />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    const [element, options] = api.render.mock.calls[0] as unknown as [
      HTMLElement,
      {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
      },
    ];
    expect(element).toBe(container.firstElementChild);
    expect(options.sitekey).toBe("0xSITE");
    options.callback("tok");
    expect(onToken).toHaveBeenLastCalledWith("tok");
    options["expired-callback"]();
    expect(onToken).toHaveBeenLastCalledWith("");
    options["error-callback"]();
    expect(onToken).toHaveBeenCalledTimes(3);
  });

  it("asks for a new check when resetKey changes, and removes the widget when it goes", async () => {
    const api = fakeTurnstile();
    const onToken = vi.fn();
    const { rerender, unmount } = render(<AceTurnstile siteKey="0xSITE" onToken={onToken} resetKey={0} />);
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    expect(api.reset).not.toHaveBeenCalled();
    rerender(<AceTurnstile siteKey="0xSITE" onToken={onToken} resetKey={1} />);
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(onToken).toHaveBeenLastCalledWith("");
    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });
});
