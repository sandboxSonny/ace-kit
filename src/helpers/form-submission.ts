import { AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";
import type { AceFormField } from "../types/forms";

/** The most a form's request may weigh. A contact form is a few kilobytes; this stops a flood of junk early. */
const maximumBodyBytes = 100_000;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What a browser sends for a ticked box: `true` from a script, "on" from a plain form. */
const isTicked = (value: unknown) => value === true || ["on", "true", "1", "yes"].includes(String(value).toLowerCase());

/**
 * Picks the form's own answers out of what the browser sent: text for most fields, true/false for a checkbox. Other
 * keys (a framework's token, the Turnstile response) are not answers and are left out.
 */
function answersFrom(fields: readonly AceFormField[], source: Record<string, unknown>) {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    const raw = source[field.handle];
    if (field.kind === "checkbox") values[field.handle] = isTicked(raw);
    else if (typeof raw === "string") values[field.handle] = raw;
    else if (typeof raw === "number") values[field.handle] = String(raw);
  }
  return values;
}

/**
 * Handles a visitor sending one of the site's forms: reads the request, passes it to the CMS (which stores it and
 * emails the owners) and answers with JSON, `{ message }` when it worked and `{ error }` with a status when it did
 * not. Make an endpoint on the site (the browser never talks to the CMS itself) and point the form at it.
 *
 * The request may be JSON (`{ "name": "Vic", ... }`, or `{ "values": { ... } }`) or an ordinary form post. The
 * spam-trap field is `honeypot` (a hidden input a real visitor leaves empty) and the Turnstile answer is
 * `turnstile_token` (or Turnstile's own `cf-turnstile-response`).
 */
export async function formSubmissionResponse(client: AceClient, request: Request, handle: string): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Send the form with POST." });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maximumBodyBytes) return json(413, { error: "That message is too big." });

  let source: Record<string, unknown>;
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (contentType.includes("application/json")) {
      const body: unknown = JSON.parse(await request.text());
      if (!isObject(body)) return json(400, { error: "That wasn't a form." });
      // Either the answers on their own or wrapped as { values }: the wrapper wins when it is there.
      source = isObject(body.values) ? { ...body, ...body.values } : body;
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      source = {};
      for (const [name, value] of (await request.formData()).entries()) {
        if (typeof value === "string" && !(name in source)) source[name] = value;
      }
    } else {
      return json(415, { error: "Send the form as JSON or as a form post." });
    }
  } catch {
    return json(400, { error: "That wasn't a form." });
  }

  try {
    const form = await client.getForm(handle);
    if (!form) return json(404, { error: "This form isn't set up." });
    const token = source.turnstile_token ?? source["cf-turnstile-response"];
    const result = await client.submitForm(handle, {
      values: answersFrom(form.fields, source),
      honeypot: typeof source.honeypot === "string" ? source.honeypot : "",
      turnstileToken: typeof token === "string" ? token : "",
    });
    return result.ok ? json(200, { message: result.message }) : json(result.status, { error: result.error });
  } catch (error) {
    if (error instanceof AceUnavailableError) {
      console.error(error.message);
      return json(503, { error: "We couldn't send that just now. Please try again in a moment." });
    }
    throw error;
  }
}
