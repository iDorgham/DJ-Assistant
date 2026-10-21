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
      // Vendored skill library synced from the global OpenCode skills dir
      // (paired with the `.opencode/skills/` entry in .gitignore). Third-party
      // scripts and assets, not project source, and several bundles are not
      // lintable CommonJS/ESM, so they are excluded to keep `eslint .` focused
      // on the workspace's own code. The backup folder holds the same vendored
      // code, parked by `pnpm skills:prune --apply`.
      ".opencode/skills/**",
      ".opencode/skills-backup/**",
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
