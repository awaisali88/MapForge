import "@fontsource-variable/inter";

import "@/assets/styles/main.css";

import { LUCIDE_CONTEXT } from "@lucide/vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router";

// Suppress the browser's native context menu site-wide so future custom map
// context menus aren't shadowed by it. The native menu is preserved for text
// editing surfaces (input / textarea / contenteditable) so cut/copy/paste keep
// working.
window.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("input, textarea, [contenteditable=''], [contenteditable='true']")) {
      return;
    }
    event.preventDefault();
  },
  { capture: true },
);

const app = createApp(App);

// @lucide/vue's <Icon> functional component calls inject(LUCIDE_CONTEXT) on
// render; provide an empty object at the root so the destructure doesn't throw
// (Vue 3.5 / Lucide 1.16 interaction).
app.provide(LUCIDE_CONTEXT, {});

app.use(createPinia());
app.use(router);

// PrimeVue in unstyled mode — all styling comes from the ui/* wrappers via the
// passthrough (pt) API.
app.use(PrimeVue, { unstyled: true });

app.mount("#app");
