import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference material, not part of the app.
    "_referencia/**",
    "diseno/**",
  ]),
  {
    rules: {
      // Full-page <a> navigation is deliberate: no RSC prefetch, no client router
      // cache surviving a clinic switch (see CLAUDE.md).
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
