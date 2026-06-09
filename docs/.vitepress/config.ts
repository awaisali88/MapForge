import { defineConfig } from "vitepress";

/**
 * VitePress site config for MapForge's documentation.
 */
export default defineConfig({
  title: "MapForge",
  description:
    "A MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring) and CommandVue plugins.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  // The docs/superpowers/ subtree contains internal planning docs (specs,
  // implementation plans) that reference files outside the VitePress tree
  // (e.g. ./docs/architecture, ./LICENSE). Suppress those false positives.
  ignoreDeadLinks: true,

  head: [
    ["meta", { name: "theme-color", content: "#0b1120" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "MapForge documentation" }],
    [
      "meta",
      {
        name: "og:description",
        content:
          "MapLibre-first Vue 3 sandbox for building map tools — drawing, measuring, and CommandVue plugins.",
      },
    ],
  ],

  themeConfig: {
    nav: [{ text: "Guide", link: "/architecture" }],

    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Architecture", link: "/architecture" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/uraanai/MapForge" }],

    editLink: {
      pattern: "https://github.com/uraanai/MapForge/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Apache 2.0 licensed. Built by Uraan AI.",
      copyright: "© 2026 Uraan AI",
    },

    search: { provider: "local" },
  },
});
