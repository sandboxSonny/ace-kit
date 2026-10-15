import ace from "@sandboxsonny/ace-kit/vite";
import { defineConfig } from "vitest/config";

// The React Router Vite plugin is left out on purpose: tests render route modules directly. Ace Kit's plugin makes the
// tests and the kit share one copy of React Router, which route modules that use the kit's components need.
export default defineConfig({
  plugins: [ace()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
