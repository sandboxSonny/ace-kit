import { useEffect, useRef } from "react";

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptAddress = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | undefined;

/** Loads Cloudflare's script once, and resolves with its API. Safe to call from every widget on the page. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptAddress;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not start."));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Turnstile could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

type AceTurnstileProps = {
  /** The form's Turnstile site key (`turnstile_site_key` of `getForm`). An empty key draws nothing. */
  siteKey: string | undefined;
  /** Called with the visitor's token once Turnstile is satisfied, and with "" when it runs out or fails. Send it as `turnstile_token`. */
  onToken?: (token: string) => void;
  /** Change this (a counter, say) after a form is sent to get a new check: a token works only once. */
  resetKey?: number;
};

/**
 * The Cloudflare Turnstile widget for a form. A form drawn by React usually appears after the page has loaded, which
 * is too late for Turnstile's automatic start, so this draws the widget itself once it is on the page. It also puts a
 * hidden `cf-turnstile-response` field in the enclosing `<form>`, and gives the token to `onToken`: a form that sends
 * JSON uses that. With no site key (the owners have not turned Turnstile on) it draws nothing.
 */
export function AceTurnstile({ siteKey, onToken, resetKey = 0 }: AceTurnstileProps) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const tokenCallback = useRef(onToken);
  useEffect(() => {
    tokenCallback.current = onToken;
  });

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    const element = container.current;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widget.current = turnstile.render(element, {
          sitekey: siteKey,
          callback: (token) => tokenCallback.current?.(token),
          "expired-callback": () => tokenCallback.current?.(""),
          "error-callback": () => tokenCallback.current?.(""),
        });
      })
      .catch((error: unknown) => console.error(error instanceof Error ? error.message : error));
    return () => {
      cancelled = true;
      if (widget.current !== undefined) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widget.current !== undefined) {
      window.turnstile?.reset(widget.current);
      tokenCallback.current?.("");
    }
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={container} />;
}
