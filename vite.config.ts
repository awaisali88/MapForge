import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/**
 * Base Vite configuration for MapForge.
 *
 * Minimal by design: the Vue + Tailwind v4 plugins, the `@` → `src` alias,
 * a fixed dev port, and the Playwright/temp watch ignores. No Cesium asset
 * wiring (MapForge is MapLibre-only).
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      // Playwright MCP writes per-interaction snapshots into `.playwright-mcp/`.
      // Without this exclusion they trigger an infinite HMR reload loop.
      ignored: ["**/.playwright-mcp/**", "**/temp/**"],
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
