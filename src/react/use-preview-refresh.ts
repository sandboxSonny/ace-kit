import { useEffect } from "react";

import { listenForPreviewRefresh } from "../helpers/preview-listener";

/**
 * Refreshes the page when the CMS's editor saves a draft, if the page is being shown inside its preview frame.
 *
 * - `adminOrigin`: where the CMS admin app runs. Pass null/undefined when the page isn't a preview and nothing happens.
 * - `refresh`: how to get fresh content. Give your framework's own (React Router's `revalidator.revalidate`); the
 *   default fetches the page again and swaps its content in.
 */
export function usePreviewRefresh(adminOrigin: string | null | undefined, refresh?: () => Promise<void>): void {
  useEffect(() => {
    if (!adminOrigin) return;
    return listenForPreviewRefresh(adminOrigin, refresh);
  }, [adminOrigin, refresh]);
}
