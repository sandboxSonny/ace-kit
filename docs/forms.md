# Forms

A **form** is something a visitor fills in and sends: a contact form, a quote request. You say what it asks in a small file; the CMS keeps what visitors send, emails the people you choose, and shows the messages in the admin app. There is no mail server to run and no email key in your site.

```
src/
  contact.form.ts     <- what the form asks
  pages/api/contact.ts <- where the browser sends it (two lines)
```

## Describing a form

```ts
// contact.form.ts
import { defineForm } from "@sandboxsonny/ace-kit";

export default defineForm({
  handle: "contact",
  name: "Contact",
  fields: [
    { handle: "name", label: "Name", type: "text", required: true },
    { handle: "email", label: "Email", type: "email", required: true },
    { handle: "topic", label: "Topic", type: "select", options: ["Quote", "Other"] },
    { handle: "message", label: "Message", type: "textarea", required: true },
    { handle: "updates", label: "Send me updates", type: "checkbox" },
  ],
});
```

Field types are `text` (one line), `email`, `textarea`, `select` (needs `options`) and `checkbox`. The `label` is what the owners see in the CMS and in the email. A form has up to 30 fields, and a site up to 20 forms.

Ace Kit sends the definitions to the CMS while the dev server runs, and with `ace-kit sync`, the same way as [sections](./sections.md) (one `ace-kit sync` does both). The list is the whole list: a form you take out of your code is kept in the CMS with its messages but stops taking new ones; define it again and it comes back. A site with no `*.form.ts` files never touches its forms.

**What the owners choose, in the CMS** (Forms in the site's menu, for a site's owners and super admins): who is emailed (up to 10 addresses), the thank-you message the visitor sees, and how long messages are kept (365 days by default, or 0 for ever). A sync never changes these.

## The endpoint

The browser never talks to the CMS: it posts to an endpoint on your site, which hands the message on.

**Astro**

```ts
// src/pages/api/contact.ts
import { getFormSubmitResponse } from "@sandboxsonny/ace-kit/astro";

export const prerender = false;
export const POST = ({ request }) => getFormSubmitResponse({ request }, "contact");
```

**React Router** (a route `route("api/contact", "routes/contact.tsx")`, before the catch-all)

```ts
// app/routes/contact.tsx
import { createFormAction } from "@sandboxsonny/ace-kit/react-router/server";

export const action = createFormAction("contact");
```

The request can be JSON (`{ "name": "Vic", "email": "…" }`) or an ordinary form post. Only the form's own fields are passed on; other keys are ignored. The answer is JSON: `{ "message": "…" }` (the owners' thank-you) with status 200, or `{ "error": "…" }`, written for the visitor, with the status the CMS gave (400 for a missing or wrong field, 429 when a form has had a lot of messages, 503 when the CMS can't be reached).

```ts
const response = await fetch("/api/contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, message, updates }),
});
const result = await response.json(); // { message } or { error }
```

## Keeping spam out

- **Honeypot.** Add a field a person never sees (hidden with CSS, `tabindex="-1"`, `autocomplete="off"`) named `honeypot`, and send what it holds. Bots fill it in; when it isn't empty the CMS says "thank you" and keeps and sends nothing.
- **Limits.** The CMS lets one address send a few forms at once and then one every 12 seconds, and takes at most 30 messages an hour per form, so one form can't use up the email allowance for every site.
- **Cloudflare Turnstile (optional).** The owners make a Turnstile widget in Cloudflare and enter its site key and secret key under **Settings → Integrations** in the CMS. It turns itself on and off with the keys; in your code you only draw the widget in the form and send its token. The CMS refuses a form sent without a good token while Turnstile is on ("please complete the check that you are a person").
  - **A plain Astro form** (an ordinary `<form>` in a `.astro` file): put `<AceTurnstile form="contact" />` (from `@sandboxsonny/ace-kit/astro/AceTurnstile.astro`) inside it. It draws nothing while Turnstile is off, and the widget adds a hidden `cf-turnstile-response` field the endpoint reads.
  - **A React form** (a React Router site, or a React component inside an Astro page): read the key where the page is built (`const form = await getForm("contact")`, in a loader or an Astro page, and pass `form?.turnstile_site_key` down), draw `<AceTurnstile siteKey={siteKey} onToken={setToken} resetKey={sent} />` (from `@sandboxsonny/ace-kit/react`) inside the form, and send the token with the rest as `turnstile_token`. Raise `resetKey` after each send, because a token works once. Use this rather than the Astro component for a form React draws: such a form appears after the page has loaded, which is too late for Turnstile's automatic start, so the React component starts the widget itself.

## What happens to a message

1. The CMS checks it against the form's fields (a mistake is sent back to the visitor in words) and stores it.
2. It emails the form's recipients from CMS Ace's own sender, with the visitor's address as the **Reply-To** (the first email field they filled in), so replying answers the visitor. Mail never claims to come from the visitor.
3. If the email fails, the message is still stored, and the admin app says it wasn't emailed and why. The visitor is not told about the failure.

The visitor is **not** sent an automatic reply; they see the thank-you message on the page.

Messages hold visitors' personal details: they are only visible to a site's owners, can be searched, marked read and deleted in the admin app, and are deleted automatically after the form's retention period.

A dev site gets the forms' definitions but no recipients and none of the messages, so a dev site never emails the real owners.
