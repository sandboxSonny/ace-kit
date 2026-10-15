import eslint from "@eslint/js";
import globals from "globals";
import jsxAccessibility from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
  { ignores: ["node_modules", "build", ".react-router", "public", "app/ace-kit.generated.d.ts"] },

  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxAccessibility,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxAccessibility.flatConfigs.recommended.rules,

      // Types are imported with `import type` from ~/types (see README "Conventions").
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

      // Dialogs move focus to their first field on purpose; the pages never autofocus anything else.
      "jsx-a11y/no-autofocus": "off",

      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "prefer-const": "error",
    },
  },

  // Tests cast framework arguments (route args, contexts) that are impractical to build in full.
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // Must stay last: turns off any rule that would fight with Prettier.
  prettierConfig,
);
