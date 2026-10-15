import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
  { ignores: ["node_modules", "dist", ".astro", "public"] },

  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...astro.configs.recommended,

  {
    files: ["**/*.{ts,astro,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Types are imported with `import type` from src/types.
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

  // Command-line scripts report what they did on the console.
  { files: ["scripts/**"], rules: { "no-console": "off" } },

  // Must stay last: turns off any rule that would fight with Prettier.
  prettierConfig,
);
