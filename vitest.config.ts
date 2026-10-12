import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Astro makes this module up in a site; tests use fixed settings.
      "astro:env/server": fileURLToPath(new URL("./src/astro/astro-env.fixture.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"], environment: "node" },
});
