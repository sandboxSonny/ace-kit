import type { SectionOf } from "@sandboxsonny/ace-kit";
import { AceTurnstile } from "@sandboxsonny/ace-kit/react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type contactForm from "./contact-form.schema";

// The browser posts to /api/contact (app/routes/contact.ts), which hands the message to the CMS.
const endpoint = "/api/contact";

type Answer = { message?: string; error?: string; siteKey?: string };
type Status = { state: "" | "success" | "error"; text: string };

/**
 * A contact form: a heading, a few words and the form. Its fields are in contact-form.schema.ts; what the form asks is
 * in app/contact.form.ts. It sends without leaving the page and shows the answer, and without JavaScript it still posts.
 */
export function ContactForm({ section }: { section: SectionOf<typeof contactForm> }) {
  const { heading, intro, button } = section.values;
  const [siteKey, setSiteKey] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(0);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "", text: "" });

  // The Turnstile site key, empty while the site's owners have Turnstile off. A form React draws appears too late for
  // Turnstile's automatic start, so the key is fetched here and AceTurnstile starts the widget itself.
  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((response) => (response.ok ? (response.json() as Promise<Answer>) : null))
      .then((answer) => {
        if (!cancelled && answer?.siteKey) setSiteKey(answer.siteKey);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true);
    setStatus({ state: "", text: "Sending…" });

    const body = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string") body.append(key, value);
    }
    if (token) body.set("turnstile_token", token);

    try {
      const response = await fetch(endpoint, { method: "POST", body });
      const answer = (await response.json()) as Answer;
      if (response.ok) {
        form.reset();
        setStatus({ state: "success", text: answer.message ?? "Thank you, your message has been sent." });
      } else {
        setStatus({ state: "error", text: answer.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setStatus({ state: "error", text: "Could not send your message. Please check your connection and try again." });
    } finally {
      setSending(false);
      // A Turnstile check works once, so ask for a new one before the next send.
      setSent((count) => count + 1);
    }
  }

  return (
    <section className="section" data-section={section.type}>
      <div className="container contact">
        {heading ? <h2>{heading}</h2> : null}
        {intro ? <p className="contact__intro">{intro}</p> : null}
        <form className="contact__form" method="post" action={endpoint} onSubmit={send}>
          <label>
            Name
            <input type="text" name="name" autoComplete="name" required />
          </label>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Message
            <textarea name="message" rows={6} required />
          </label>
          {/* A field no person sees. Bots fill it in, and the CMS then keeps and sends nothing. */}
          <div className="contact__trap" aria-hidden="true">
            <label>
              Leave this empty
              <input type="text" name="honeypot" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {/* Draws Cloudflare Turnstile when the site's owners have turned it on in the CMS, and nothing otherwise. */}
          <AceTurnstile siteKey={siteKey} onToken={setToken} resetKey={sent} />
          <button type="submit" className="button" disabled={sending}>
            {button || "Send message"}
          </button>
          <p className="contact__status" role="status" aria-live="polite" data-state={status.state}>
            {status.text}
          </p>
        </form>
      </div>
    </section>
  );
}
