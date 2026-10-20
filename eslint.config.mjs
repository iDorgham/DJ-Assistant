// Flat ESLint config for the whole pnpm workspace.
//
// Prettier owns formatting (see `eslint-config-prettier` at the end); ESLint
// owns code-quality rules. Hook rules apply only to the desktop React app, and
// we opt into just the two stable `react-hooks` rules rather than the v7
// React-Compiler rule suite (this app is React 18, not compiler-driven yet).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/target/**",
      // Rust crate plus Tauri-generated schemas — no lintable JS/TS.
      "apps/desktop/src-tauri/**",
      // uv-managed Python env kept on disk but not in git; its vendored
      // site-packages JS bundles are not lintable.
      "b5bf2e54cb654f7b/**",
      // Machine-local OpenCode skill library (scripts, assets, vendored bundles).
      // Untracked and not project source; linting it produces ~950 no-undef /
      // no-require-imports errors from third-party skill code.
      ".opencode/skills/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Node context: workspace/test scripts, build tooling, the API server.
    files: ["**/*.{js,mjs,cjs}", "**/*.config.ts", "apps/api/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    // Browser context: the desktop UI.
    files: ["apps/desktop/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  prettier
);
