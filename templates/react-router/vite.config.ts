import ace from "@sandboxsonny/ace-kit/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [ace(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
