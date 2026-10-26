import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "./contact-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const section = {
  id: "c",
  type: "contact-form",
  values: { heading: "Get in touch", intro: "We reply within a day.", button: "Send" },
  blocks: [],
} as never;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** Answers the form's first request (the Turnstile key) and then each send with `answer`. */
function stubFetch(answer: () => Response) {
  const send = vi.fn((_address: string, init?: RequestInit) =>
    Promise.resolve(init?.method === "POST" ? answer() : json(200, { siteKey: "" })),
  );
  vi.stubGlobal("fetch", send);
  return send;
}

function fillIn() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Vic" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "vic@example.com" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("the contact form", () => {
  it("shows the editor's words and posts to the site's endpoint", () => {
    stubFetch(() => json(200, { message: "Thanks!" }));
    render(<ContactForm section={section} />);
    expect(screen.getByRole("heading", { name: "Get in touch" })).toBeTruthy();
    expect(screen.getByText("We reply within a day.")).toBeTruthy();
    expect(document.querySelector("form")?.getAttribute("action")).toBe("/api/contact");
  });

  it("sends the answers and the honeypot, and shows the owners' thank-you", async () => {
    const send = stubFetch(() => json(200, { message: "Thanks!" }));
    render(<ContactForm section={section} />);
    fillIn();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Thanks!"));
    const [address, init] = send.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(address).toBe("/api/contact");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("name")).toBe("Vic");
    expect(body.get("message")).toBe("Hello");
    expect(body.get("honeypot")).toBe("");
  });

  it("shows what the visitor should fix", async () => {
    stubFetch(() => json(400, { error: "Please fill in your email." }));
    render(<ContactForm section={section} />);
    fillIn();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Please fill in your email."));
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("error");
  });
});
