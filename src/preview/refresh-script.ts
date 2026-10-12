// Runs in the browser, inside the CMS's preview frame. It does nothing unless the page says which admin app may
// ask it to refresh (the element AcePreviewRefresh renders for a page shown with a preview token).
import { listenForPreviewRefresh } from "../helpers/preview-listener";

const adminOrigin = document.querySelector<HTMLElement>("[data-ace-preview-origin]")?.dataset.acePreviewOrigin;

if (adminOrigin) listenForPreviewRefresh(adminOrigin);
