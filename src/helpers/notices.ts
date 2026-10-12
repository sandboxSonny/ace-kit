import type { AcePage } from "../types/page";

/** What a page that isn't an entry says: a heading and a message. Shared by every framework's notice component. */
export const pageNotices: Record<AcePage["kind"], { heading: string; message: string }> = {
  redirect: { heading: "Redirecting", message: "This page has moved." },
  "preview-expired": {
    heading: "Preview expired",
    message: "This preview link has run out. Reload the editor in the CMS to get a new one.",
  },
  unavailable: {
    heading: "Temporarily unavailable",
    message: "This page can't be shown right now. Please try again shortly.",
  },
  "not-found": { heading: "Page not found", message: "There's nothing at this address." },
  entry: { heading: "", message: "" },
};
