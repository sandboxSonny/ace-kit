import { defineConfig } from "tsup";

// Each entry's declarations are built on their own, so each is a single file. That matters for `AceContentTypes`:
// the types `ace-kit generate` writes add to it by declaration merging, which only works when the interface is
// declared in the file TypeScript finds for the package, not re-exported from a shared chunk.
const declarations = (name: string, entry: string) => ({
  entry: { [name]: entry },
  format: ["esm" as const],
  // tsup adds `baseUrl` itself, which TypeScript 6 warns about.
  dts: { only: true, compilerOptions: { ignoreDeprecations: "6.0" as const } },
  clean: false,
});

export default defineConfig([
  {
    // The framework-free core, the two adapters, and the browser script that refreshes the live preview.
    entry: {
      index: "src/index.ts",
      react: "src/react/index.ts",
      astro: "src/astro/index.ts",
      "react-router": "src/react-router/index.ts",
      "react-router-server": "src/react-router/server.tsx",
      vite: "src/vite/plugin.ts",
      "astro-integration": "src/astro/integration.ts",
      "astro-middleware": "src/astro/middleware.ts",
      "preview-script": "src/preview/refresh-script.ts",
    },
    format: ["esm"],
    external: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      /^react-dom\//,
      "react-router",
      "@react-router/node",
      "vite",
      "astro",
      /^astro\//,
      /^astro:/,
    ],
    clean: true,
    splitting: true,
    treeshake: true,
  },
  {
    // The command line tool.
    entry: { cli: "src/generate/cli.ts" },
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    clean: false,
  },
  declarations("index", "src/index.ts"),
  declarations("react", "src/react/index.ts"),
  declarations("astro", "src/astro/index.ts"),
  declarations("astro-integration", "src/astro/integration.ts"),
  declarations("react-router", "src/react-router/index.ts"),
  declarations("react-router-server", "src/react-router/server.tsx"),
  declarations("vite", "src/vite/plugin.ts"),
]);
