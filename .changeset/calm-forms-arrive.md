---
"@sandboxsonny/ace-kit": minor
---

Forms. Describe a form in a `*.form.ts` file with `defineForm` (text, email, textarea, select and checkbox fields); `ace-kit sync` and the dev server send it to the CMS, which stores what visitors send, emails the people the site's owners chose (with the visitor as Reply-To) and shows the messages in the admin app. A one-line endpoint (`getFormSubmitResponse` for Astro, `createFormAction` for React Router, or `formSubmissionResponse` anywhere) hands a visitor's message to the CMS and answers with JSON. Spam protection: a `honeypot` field, limits in the CMS, and optional Cloudflare Turnstile that switches on when the owners enter its keys in the CMS (`<AceTurnstile form="contact" />` for Astro, `AceTurnstile` for React). New client methods `getForm` and `submitForm`. See docs/forms.md.
