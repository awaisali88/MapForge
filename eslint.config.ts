import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import perfectionist from "eslint-plugin-perfectionist";
import pluginVue from "eslint-plugin-vue";

/**
 * Flat ESLint config for MapForge.
 *
 * Composition:
 *   - eslint-plugin-vue (flat/recommended)
 *   - @vue/eslint-config-typescript (recommended, no type-aware rules — fast)
 *   - eslint-plugin-perfectionist (import sorting only)
 *   - @vue/eslint-config-prettier/skip-formatting (defer formatting to Prettier)
 *
 * Custom rules:
 *   - no-explicit-any is an error
 *   - consistent-type-imports + verbatimModuleSyntax expects `import type`
 *   - vue/multi-word-component-names is off (App.vue and view names allowed)
 *   - no-console warns except for warn / error
 *   - PrimeVue components are imported only inside src/components/ui/** ;
 *     consumers use the ui/* wrappers (PrimeVue-first rule)
 *   - raw <button>/<input>/<select>/<textarea> restricted outside ui/**
 */
export default defineConfigWithVueTs(
  {
    name: "mapforge/ignores",
    ignores: [
      "**/dist/**",
      "**/dist-ssr/**",
      "**/coverage/**",
      "**/.vite/**",
      "**/node_modules/**",
      "pnpm-lock.yaml",
      "dictionaries/**",
      ".husky/_/**",
      "eslint.config.ts",
      // VitePress config is standalone (loaded by the `vitepress` CLI via its
      // own bundler); not part of the app's project-references graph.
      "docs/.vitepress/**",
    ],
  },
  {
    name: "mapforge/files",
    files: ["**/*.{ts,mts,tsx,vue}"],
  },
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: "mapforge/rules",
    plugins: {
      perfectionist,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vue/multi-word-component-names": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Restrict direct PrimeVue *component* imports from consumer code. The
      // negation entries carve out non-component helper modules (types, the
      // bootstrap config/api singletons). Consumers use the ui/* wrappers.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["primevue/*", "!primevue/menuitem", "!primevue/config", "!primevue/api"],
              message:
                "Direct primevue/* component imports are restricted to UI primitive files (src/components/ui/**). Consumer code should import the project wrapper instead.",
              allowTypeImports: true,
            },
          ],
        },
      ],
      "vue/no-restricted-html-elements": [
        "warn",
        {
          element: ["button", "input", "select", "textarea"],
          message:
            "Raw HTML interactive elements are restricted. Use the UI primitive wrappers in src/components/ui/* (Button, IconButton, Select).",
        },
      ],
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          newlinesBetween: 1,
          groups: [
            "type",
            ["builtin", "external"],
            "type-internal",
            "internal",
            ["type-parent", "type-sibling", "type-index"],
            ["parent", "sibling", "index"],
            "unknown",
          ],
        },
      ],
    },
  },
  {
    name: "mapforge/declarations",
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // UI primitive layer — these files are the wrappers themselves, so raw
    // HTML interactive elements and direct primevue/* imports are expected.
    // The restrictions above apply to *consumers* of these primitives.
    name: "mapforge/ui-primitives",
    files: ["src/components/ui/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
      "vue/no-restricted-html-elements": "off",
    },
  },
);
