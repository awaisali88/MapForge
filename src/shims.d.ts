declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>;
  export default component;
}

// CSS-only side-effect imports. TypeScript 6 requires explicit type info
// for `import "<pkg>"` patterns even when the package is pure CSS.
declare module "@fontsource-variable/inter" {}
declare module "floating-vue/dist/style.css" {}
declare module "maplibre-gl/dist/maplibre-gl.css" {}
