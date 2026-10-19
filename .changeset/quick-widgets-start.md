---
"@sandboxsonny/ace-kit": patch
---

Fix the React `AceTurnstile` widget not appearing in a form drawn by React (a React component in an Astro page, or a React Router site): it relied on Turnstile's automatic start, which has already happened by the time such a form is on the page. It now starts the widget itself, and takes `onToken` (to send the token as `turnstile_token`) and `resetKey` (to get a new check after a send). The docs now say how to use it with a React form.
