import { describe, expect, it, vi } from "vitest";

import { AceUnavailableError } from "../client/errors";
import type { AceClient } from "../client/create-client";
import type { AceForm } from "../types/forms";
import { formSubmissionResponse } from "./form-submission";

const form: AceForm = {
  handle: "contact",
  name: "Contact",
  thank_you: "Thanks!",
  turnstile_site_key: "",
  fields: [
    { handle: "name", label: "Name", kind: "text", required: true },
    { handle: "email", label: "Email", kind: "email", required: true },
    { handle: "updates", label: "Updates", kind: "checkbox", required: false },
  ],
};

function clientWith(overrides: Partial<Record<"getForm" | "submitForm", unknown>> = {}) {
  const submitForm = vi.fn(async () => ({ ok: true as const, message: "Thanks!" }));
  const getForm = vi.fn(async () => form as AceForm | null);
  const client = { getForm, submitForm, ...overrides } as unknown as AceClient;
  return { client, submitForm: (overrides.submitForm ?? submitForm) as typeof submitForm };
}

const jsonRequest = (body: unknown, extra: RequestInit = {}) =>
  new Request("https://site.test/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...extra,
  });

describe("formSubmissionResponse", () => {
  it("passes the form's answers to the CMS and answers with the thank-you, never cached", async () => {
    const { client, submitForm } = clientWith();
    const response = await formSubmissionResponse(
      client,
      jsonRequest({ name: "Vic", email: "vic@example.org", updates: true, extra: "ignored", csrf: "x" }),
      "contact",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Thanks!" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(submitForm).toHaveBeenCalledWith("contact", {
      values: { name: "Vic", email: "vic@example.org", updates: true },
      honeypot: "",
      turnstileToken: "",
    });
  });

  it("also takes the answers wrapped in values, the honeypot and the Turnstile token", async () => {
    const { client, submitForm } = clientWith();
    await formSubmissionResponse(
      client,
      jsonRequest({ values: { name: "Vic", email: "v@x.org" }, honeypot: "spam", turnstile_token: "tok" }),
      "contact",
    );
    expect(submitForm).toHaveBeenCalledWith("contact", {
      values: { name: "Vic", email: "v@x.org", updates: false },
      honeypot: "spam",
      turnstileToken: "tok",
    });
  });

  it("reads an ordinary form post, with a ticked box as true and Turnstile's own field", async () => {
    const { client, submitForm } = clientWith();
    const body = new URLSearchParams({ name: "Vic", email: "v@x.org", updates: "on", "cf-turnstile-response": "tok" });
    await formSubmissionResponse(
      client,
      new Request("https://site.test/api/contact", { method: "POST", body }),
      "contact",
    );
    expect(submitForm).toHaveBeenCalledWith("contact", {
      values: { name: "Vic", email: "v@x.org", updates: true },
      honeypot: "",
      turnstileToken: "tok",
    });
  });

  it("passes on the CMS's refusal in the visitor's words, with its status", async () => {
    const { client } = clientWith({
      submitForm: vi.fn(async () => ({ ok: false as const, status: 400, error: "Name is required" })),
    });
    const response = await formSubmissionResponse(client, jsonRequest({ email: "v@x.org" }), "contact");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Name is required" });
  });

  it("says try again when the CMS can't be reached, without the detail", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = clientWith({
      submitForm: vi.fn(async () => {
        throw new AceUnavailableError("Could not reach the CMS.");
      }),
    });
    const response = await formSubmissionResponse(client, jsonRequest({ name: "Vic" }), "contact");
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("CMS");
    error.mockRestore();
  });

  it("refuses what is not a form post: other methods, other content, junk, a form that isn't there, a big body", async () => {
    const { client } = clientWith();
    const status = async (request: Request, clientToUse = client) =>
      (await formSubmissionResponse(clientToUse, request, "contact")).status;
    expect(await status(new Request("https://site.test/api/contact"))).toBe(405);
    expect(
      await status(
        new Request("https://site.test/api/contact", {
          method: "POST",
          body: "x",
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    ).toBe(415);
    expect(await status(jsonRequest("not an object"))).toBe(400);
    expect(
      await status(
        new Request("https://site.test/api/contact", {
          method: "POST",
          body: "{nope",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).toBe(400);
    expect(
      await status(jsonRequest({}, { headers: { "Content-Type": "application/json", "Content-Length": "999999" } })),
    ).toBe(413);
    expect(await status(jsonRequest({}), clientWith({ getForm: vi.fn(async () => null) }).client)).toBe(404);
  });
});
