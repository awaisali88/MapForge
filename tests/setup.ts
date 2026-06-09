/**
 * Global Vitest setup.
 *
 * jsdom has no ResizeObserver; @vueuse/core useElementSize (ThemeStudioPanel
 * responsive Splitter, C6) constructs one at mount, so every spec that mounts
 * the panel needs this stub. Add testing-library matchers / global mocks here
 * as the test surface grows.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no matchMedia; PrimeVue Select binds a media-orientation listener at
// mount (ThemeStudioPanel mounts Select). Stub a non-matching query.
globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof matchMedia;

export {};
