import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "artifacts/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ["src/**/*.tsx"], ...hooks.configs.flat.recommended },
  {
    files: ["src/**/*.tsx"],
    ...a11y.flatConfigs.recommended,
    settings: {
      "jsx-a11y": { components: { TextField: "input", Button: "button" } },
    },
  },
);
