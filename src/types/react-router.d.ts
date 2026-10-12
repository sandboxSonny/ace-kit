import type { AceNavigationLink } from "./menus";

/** What the root loader (`createRootLoader`) puts in the root route's data, for `useAceMenu` and `useAcePreview`. */
export type AceRootData = {
  ace: {
    /** The header menu's links, or the fallback. */
    menuLinks: AceNavigationLink[];
    /** Where the CMS admin app runs, when this page is a preview shown inside its editor; otherwise null. */
    previewAdminOrigin: string | null;
  };
};
