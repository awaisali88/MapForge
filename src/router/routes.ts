import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "map-home",
    component: () => import("@/views/MapHome.vue"),
  },
];
