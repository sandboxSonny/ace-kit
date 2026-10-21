// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceContactForm } from "./contactForm";

function drawForm() {
  document.body.innerHTML = `
    <form action="/api/contact" data-contact-form>
      <input name="name" />
      <input name="email" />
      <textarea name="message"></textarea>
      <button type="submit">Send</button>
      <p data-contact-status></p>
    </form>`;
  const form = document.querySelector<HTMLFormElement>("form")!;
  // Typed in, not written into the markup: reset() puts back whatever the markup said.
  form.querySelector<HTMLInputElement>("[name=name]")!.value = "Vic";
  form.querySelector<HTMLInputElement>("[name=email]")!.value = "vic@example.com";
  form.querySelector<HTMLTextAreaElement>("[name=message]")!.value = "Hello";
  return form;
}

function answer(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

/** Submits the form and waits for the handler (which awaits the reply) to finish. */
async function submit(form: HTMLFormElement) {
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() => expect(form.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false));
}

afterEach(() => {
  delete (window as { turnstile?: unknown }).turnstile;
});

describe("enhanceContactForm", () => {
  it("posts the fields to the form's action and shows the thank-you message", async () => {
    const form = drawForm();
    const send = answer(200, { message: "Thanks, we will be in touch." });
    enhanceContactForm(form, send as unknown as typeof fetch);

    await submit(form);

    const [address, options] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toContain("/api/contact");
    expect(options.method).toBe("POST");
    expect((options.body as URLSearchParams).get("email")).toBe("vic@example.com");
    const status = form.querySelector<HTMLElement>("[data-contact-status]")!;
    expect(status.textContent).toBe("Thanks, we will be in touch.");
    expect(status.dataset.state).toBe("success");
  });

  it("empties the form after a successful send", async () => {
    const form = drawForm();
    enhanceContactForm(form, answer(200, { message: "Thanks" }) as unknown as typeof fetch);

    await submit(form);

    expect(form.querySelector<HTMLInputElement>("[name=email]")!.value).toBe("");
  });

  it("keeps what was typed and shows the reason when the CMS refuses it", async () => {
    const form = drawForm();
    enhanceContactForm(form, answer(400, { error: "Please enter a valid email address." }) as unknown as typeof fetch);

    await submit(form);

    const status = form.querySelector<HTMLElement>("[data-contact-status]")!;
    expect(status.textContent).toBe("Please enter a valid email address.");
    expect(status.dataset.state).toBe("error");
    expect(form.querySelector<HTMLInputElement>("[name=email]")!.value).toBe("vic@example.com");
  });

  it("says so when the site cannot be reached", async () => {
    const form = drawForm();
    const send = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    enhanceContactForm(form, send as unknown as typeof fetch);

    await submit(form);

    const status = form.querySelector<HTMLElement>("[data-contact-status]")!;
    expect(status.dataset.state).toBe("error");
    expect(status.textContent).toContain("Could not send");
  });

  it("disables the button while sending, so a message goes once", async () => {
    const form = drawForm();
    let reply!: (response: Response) => void;
    const send = vi.fn(() => new Promise<Response>((resolve) => (reply = resolve)));
    enhanceContactForm(form, send as unknown as typeof fetch);
    const button = form.querySelector<HTMLButtonElement>("button")!;

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(button.disabled).toBe(true);
    expect(form.querySelector("[data-contact-status]")!.textContent).toBe("Sending…");

    reply(new Response(JSON.stringify({ message: "Thanks" }), { status: 200 }));
    await vi.waitFor(() => expect(button.disabled).toBe(false));
  });

  it("asks Turnstile for a new check after each send", async () => {
    const form = drawForm();
    const reset = vi.fn();
    (window as { turnstile?: unknown }).turnstile = { reset };
    enhanceContactForm(form, answer(200, { message: "Thanks" }) as unknown as typeof fetch);

    await submit(form);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("works when Turnstile is off", async () => {
    const form = drawForm();
    enhanceContactForm(form, answer(200, { message: "Thanks" }) as unknown as typeof fetch);

    await expect(submit(form)).resolves.toBeUndefined();
  });
});
