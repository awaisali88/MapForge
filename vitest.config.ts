import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

/**
 * Vitest configuration.
 *
 * Inherits the app's Vite config (so the `@/*` alias and plugins apply to
 * tests) and adds a jsdom environment, a setup file, and the standard
 * Vitest excludes plus an `e2e/**` carve-out for any future Playwright suite.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./tests/setup.ts"],
      exclude: [...configDefaults.exclude, "e2e/**", "dist/**"],
      root: fileURLToPath(new URL("./", import.meta.url)),
    },
  }),
);
