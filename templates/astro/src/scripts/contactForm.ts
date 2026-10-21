type Answer = { message?: string; error?: string };

/**
 * Makes a contact form send without leaving the page and show the answer: the owners' thank-you message, or what the
 * visitor should fix. Without JavaScript the form still posts to its `action`.
 */
export function enhanceContactForm(form: HTMLFormElement, send: typeof fetch = fetch): void {
  const status = form.querySelector<HTMLElement>("[data-contact-status]");
  const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (!status || !submit) return;

  function show(state: "success" | "error" | "", text: string) {
    status!.dataset.state = state;
    status!.textContent = text;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    show("", "Sending…");

    const body = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string") body.append(key, value);
    }

    try {
      const response = await send(form.action, { method: "POST", body });
      const answer = (await response.json()) as Answer;
      if (response.ok) {
        form.reset();
        show("success", answer.message ?? "Thank you, your message has been sent.");
      } else {
        show("error", answer.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      show("error", "Could not send your message. Please check your connection and try again.");
    } finally {
      submit.disabled = false;
      // A Turnstile check works once, so ask for a new one before the next send.
      (window as { turnstile?: { reset: () => void } }).turnstile?.reset();
    }
  });
}
