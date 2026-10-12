import { isRefreshRequest, swapPageContent } from "./preview";

/** Fetches this page again and swaps its content in; the preview token is still in the address. */
export async function refreshPageContent(): Promise<void> {
  const response = await fetch(location.href, { cache: "no-store" });
  if (response.ok) swapPageContent(document, new DOMParser().parseFromString(await response.text(), "text/html"));
}

/**
 * Listens, in the browser, for the CMS asking the page to refresh (it does when the editor saves a draft) and calls
 * `refresh`. Only messages from the admin origin count. Messages that arrive while a refresh is under way are folded
 * into one more refresh afterwards. Returns a function that stops listening.
 */
export function listenForPreviewRefresh(
  adminOrigin: string,
  refresh: () => Promise<void> = refreshPageContent,
): () => void {
  let refreshing = false;
  let again = false;

  async function run() {
    if (refreshing) {
      again = true;
      return;
    }
    refreshing = true;
    try {
      await refresh();
    } catch (error) {
      console.error("The preview could not be refreshed.", error);
    } finally {
      refreshing = false;
      if (again) {
        again = false;
        void run();
      }
    }
  }

  const onMessage = (event: MessageEvent) => {
    if (isRefreshRequest(event, adminOrigin)) void run();
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
