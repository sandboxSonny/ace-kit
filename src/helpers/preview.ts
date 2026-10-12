/** The address parameter the CMS puts in the preview frame's address. */
export const previewParameter = "cms_preview";

/** What the CMS sends the page when the draft has changed. */
export const refreshMessageType = "cms-ace:refresh";

/**
 * The origin (`https://admin.example.com`, with no path or trailing slash) of a web address, or null if it isn't a
 * web address. Browsers report a message's origin in exactly this form, so origins are compared in it.
 */
export function originOf(address: string): string | null {
  try {
    const parsed = new URL(address);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Whether a message is the CMS asking the page to refresh, from the admin origin we expect and no one else. */
export function isRefreshRequest(event: { origin: string; data: unknown }, adminOrigin: string): boolean {
  const expected = originOf(adminOrigin);
  if (expected === null || event.origin !== expected) return false;
  return (
    typeof event.data === "object" &&
    event.data !== null &&
    (event.data as { type?: unknown }).type === refreshMessageType
  );
}

/** The preview token in an address, if any. */
export function previewTokenFrom(address: URL): string | null {
  return address.searchParams.get(previewParameter) || null;
}

/**
 * Who may show this site inside a frame: itself and the CMS admin app, so the editor can preview
 * it and nobody else can frame it (clickjacking).
 */
export function framingPolicy(adminOrigin: string): string {
  const origin = originOf(adminOrigin);
  if (origin === null) {
    throw new Error(
      `The CMS admin address must be a web address like https://admin.example.com (got "${adminOrigin}"). ` +
        "Check ACE_PREVIEW_ADMIN_ORIGIN.",
    );
  }
  return `frame-ancestors 'self' ${origin}`;
}

/**
 * Adds the framing policy to a response's headers without losing a Content-Security-Policy the site already sends:
 * the policy is added to it, replacing only a `frame-ancestors` directive it already has (which would otherwise
 * stop the CMS's editor showing the site).
 */
export function addFramingPolicy(headers: Headers, adminOrigin: string): void {
  const policy = framingPolicy(adminOrigin);
  const existing = headers.get("Content-Security-Policy");
  if (!existing) {
    headers.set("Content-Security-Policy", policy);
    return;
  }
  const others = existing
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive !== "" && !/^frame-ancestors(\s|$)/i.test(directive));
  headers.set("Content-Security-Policy", [...others, policy].join("; "));
}

/** The headers for a page shown with a preview token: never cached, never indexed. */
export const previewHeaders: Record<string, string> = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * Swaps the page's content for the same page fetched again. Only the body's children and the title change, so
 * the scroll position, the scripts and the styles stay as they are and nothing flashes.
 */
export function swapPageContent(current: Document, fresh: Document): void {
  current.title = fresh.title;
  current.body.replaceChildren(...Array.from(fresh.body.childNodes).map((node) => current.importNode(node, true)));
}
