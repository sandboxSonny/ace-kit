import { createFormAction, getAceClient } from "@sandboxsonny/ace-kit/react-router/server";

// Where the contact form posts: the CMS stores the message and emails the people the site's owners chose, and the
// answer is JSON (`{ message }`, or `{ error }` with a status).
export const action = createFormAction("contact");

// The form's Turnstile site key, which the form fetches once it is on the page. Empty while Turnstile is off, and when
// the CMS can't be reached (the send then explains).
export async function loader() {
  const form = await getAceClient()
    .getForm("contact")
    .catch(() => null);
  return Response.json({ siteKey: form?.turnstile_site_key ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
