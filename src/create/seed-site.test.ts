import { describe, expect, it } from "vitest";

import { createAndSeedSite } from "./seed-site";

describe("createAndSeedSite", () => {
  it("shows what the CMS says as plain text: no terminal escape codes, and not too long", async () => {
    const outcome = await createAndSeedSite({
      apiUrl: "http://cms.test",
      token: "t",
      name: "Shop",
      domain: "shop.example.com",
      framework: "react-router",
      sectionTypes: null,
      fetchImplementation: async (_input, init) =>
        init?.method === "POST"
          ? new Response(JSON.stringify({ error: `\u001b[2Jbad ${"x".repeat(1000)}` }), { status: 400 })
          : new Response("[]"),
    });
    expect(outcome.kind).toBe("failed");
    const message = outcome.kind === "failed" ? outcome.message : "";
    expect(message).not.toContain("\u001b");
    expect(message.startsWith("[2Jbad")).toBe(true);
    expect(message.length).toBeLessThanOrEqual(300);
  });
});
