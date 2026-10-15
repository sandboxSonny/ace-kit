import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["node_modules", "dist", "storybook-static", ".storybook/cache", "CHANGELOG.md", "templates"] },

  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...astro.configs.recommended,
  reactHooks.configs.flat.recommended,

  {
    files: ["**/*.{ts,tsx,astro,mjs,js}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Types are imported with `import type`.
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "separate-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

      // No abbreviated names in code. Spell it out: `request`, `response`, `message`...
      "id-denylist": [
        "error",
        "req",
        "res",
        "resp",
        "cfg",
        "msg",
        "btn",
        "tmp",
        "idx",
        "evt",
        "cb",
        "fn",
        "opts",
        "args",
        "val",
        "num",
        "str",
        "obj",
        "arr",
      ],

      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "prefer-const": "error",
    },
  },

  // The command line tool and the build scripts report what they did on the console.
  { files: ["src/generate/**", "scripts/**"], rules: { "no-console": "off" } },

  // Storybook's own API is called `args`.
  { files: ["stories/**"], rules: { "id-denylist": "off" } },

  // Must stay last: turns off any rule that would fight with Prettier.
  prettierConfig,
);
