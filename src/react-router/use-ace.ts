import { useCallback } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";

import { usePreviewRefresh } from "../react/use-preview-refresh";
import type { AceNavigationLink } from "../types/menus";
import type { AceRootData } from "../types/react-router";

/** What `createRootLoader` put in the root route's data, if the root route used it. */
function useAceRootData(): AceRootData["ace"] | undefined {
  return useRouteLoaderData<AceRootData>("root")?.ace;
}

/** The header menu's links (the CMS menu, or the fallback), as `[{ label, to, children? }]`. Needs `createRootLoader`. */
export function useAceMenu(): AceNavigationLink[] {
  return useAceRootData()?.menuLinks ?? [];
}

/**
 * Keeps live preview fresh. Call it once, in the root component. When this page is shown inside the CMS's editor and the
 * editor saves a draft, the page's data is loaded again and redrawn without a reload. Elsewhere it does nothing.
 * Needs `createRootLoader`, which knows whether the page is a preview.
 */
export function useAcePreview(): void {
  const { revalidate } = useRevalidator();
  const refresh = useCallback(() => revalidate(), [revalidate]);
  usePreviewRefresh(useAceRootData()?.previewAdminOrigin, refresh);
}
