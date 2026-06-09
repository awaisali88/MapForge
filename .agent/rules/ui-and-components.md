# UI & components

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Library-first rule (MANDATORY)

**Before building any UI component, check if PrimeVue — or another already-installed library in the locked stack — has a pre-built equivalent. If it does, use it. Do not roll your own.**

This applies to every UI surface: menus, dropdowns, dialogs, context menus, form controls, tooltips, sliders, tags, dividers — all of it. PrimeVue 4 ships 80+ unstyled components consumed with `:pt` (passthrough) for Tailwind theming. Maps come from `maplibre-gl`. The locked-stack table (in [`project-and-stack.md`](./project-and-stack.md)) names everything available.

### Workflow

1. **Before writing markup** for a new UI element, scan PrimeVue's component list (https://primevue.org — fetch via Context7 with library id `/websites/primevue`). The full reference workflow lives in [`.agent/workflows/library-first.md`](../workflows/library-first.md).
2. **If a PrimeVue component fits**, use it directly (or extend the relevant `src/components/ui/*` wrapper). Style via `:pt` to match project tokens — never rely on PrimeVue's bundled styles.
3. **If no PrimeVue component fits**, surface the gap before writing custom code. Ask the user.
4. **If something custom genuinely is required**, document why in the component's docstring.

### Common mappings (memorize)

| Need                           | Use                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Modal / dialog                 | PrimeVue `Dialog`                                                                                |
| Right-click context menu       | PrimeVue `ContextMenu` (wrapped by `ui/ContextMenu`) — never hand-roll outside-click + clientX/Y |
| Top menu bar / nested submenus | PrimeVue `Menubar`                                                                               |
| Dropdown popup                 | PrimeVue `Menu` (popup mode) or `TieredMenu`                                                     |
| Tabbed UI                      | PrimeVue `Tabs` + `TabList` + `Tab` + `TabPanels`                                                |
| Section grouping with legend   | PrimeVue `Fieldset`                                                                              |
| Inline label / badge           | PrimeVue `Tag` or `Chip`                                                                         |
| Dropdown select                | PrimeVue `Select` (wrapped by `ui/Select`)                                                       |
| Text input                     | PrimeVue `InputText` or `IconField` + `InputIcon`                                                |
| Textarea                       | PrimeVue `Textarea` — never raw `<textarea>`                                                     |
| Checkbox / radio               | PrimeVue `Checkbox` (`binary`) / `RadioButton`                                                   |
| Color picker                   | PrimeVue `ColorPicker` — never `<input type=color>`                                              |
| Range / slider                 | `ui/Slider` (hand-rolled, pointer-capture) or PrimeVue `Slider` — never `<input type=range>`     |
| Date picker                    | PrimeVue `DatePicker`                                                                            |
| Button                         | PrimeVue `Button` (wrapped by `ui/Button` + `ui/IconButton`)                                     |
| Tooltip                        | `ui/Tooltip` (floating-vue)                                                                      |
| Popover                        | PrimeVue `Popover`                                                                               |
| Divider                        | PrimeVue `Divider`                                                                               |

If the need isn't on this list, check the PrimeVue catalog before inventing custom markup. Add new mappings here as you discover them. (A tabular-data surface — `@tanstack/vue-table` via a `DataTable.vue` wrapper — is deferred; add it and an ADR if/when a table is needed.)

---

## UI primitives

MapForge uses PrimeVue (unstyled mode) as the foundation for UI primitives, wrapped under `src/components/ui/*` with the project token vocabulary applied via `:pt`.

- **Shipped wrappers today:** `Button`, `IconButton`, `Select`, `Tooltip` (floating-vue), `Slider` (hand-rolled pointer-capture), `ContextMenu`.
- **Default location for a new primitive:** `src/components/ui/<Name>.vue` — a thin wrapper over the PrimeVue component, styled via `:pt`, exposing a narrowed project API.
- **Forbidden:** raw `<button>`, `<input>`, `<select>`, `<textarea>` outside the UI-primitive definitions themselves. ESLint enforces this (warn-level); the `ui/**` files are exempt.
- **Forbidden:** non-PrimeVue UI libraries (Element Plus, Naive UI, Vuetify, etc.) without explicit justification.

---

## Icon usage rules

- **@lucide/vue** — the icon set for UI chrome (buttons, toolbars, controls, status). Always use **named imports** (`import { Ruler } from "@lucide/vue"`); never `import * as Icons`. Tree-shaking depends on it.
- If a feature needs a different/larger icon set later, add it to the locked stack first.

---

## Styling rules

- Tailwind v4 utility-first. No CSS modules; no scoped styles for layout/spacing.
- Use the `cn()` helper from `src/utils/cn.ts` (clsx + tailwind-merge) when composing dynamic classes.
- Design tokens live in `src/assets/styles/tokens.css` as CSS variables. Override brand colors there; don't hardcode hex in components.
- Dark mode toggles via `data-theme="dark"` on `<html>` (MapForge defaults to `dark`).
