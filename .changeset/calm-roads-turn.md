---
"@sandboxsonny/ace-kit": minor
---

Follow the redirects set up in the CMS. When a request is for an address the site has no page for, `getPage` (and the React Router page loader) now asks the CMS whether the site's owners redirected it, and answers with that redirect (301 or 302, to a path on the site or another address) instead of "not found". Your page already handles redirects, so there is nothing to change. A page shown in the CMS's preview frame is never redirected. Also adds `client.getRedirect(address)`.
