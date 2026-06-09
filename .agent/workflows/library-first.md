# Library-first workflow

**Rule:** before building any UI component, check whether PrimeVue (or another already-installed library) has a pre-built equivalent. If it does, use it. If you're unsure, stop and ask the user. The full mandate lives in [`CLAUDE.md`](../../CLAUDE.md) under "Library-first rule".

This workflow tells you HOW to check.

## Before you write markup

When a task needs new UI — a menu, a dialog, a table, a form control, a section header, a chip, a context menu, a file picker — pause before writing any custom HTML and run the check below.

### Step 1: Identify what kind of component you need

Name the role in one sentence: "right-click context menu," "scrollable table with sortable columns," "tabbed pane," "checkbox," "hex color picker," "file upload from a menu item," etc.

### Step 2: Check the mapping table in CLAUDE.md

The "Library-first rule → Common mappings" table in CLAUDE.md lists the most-used components and their PrimeVue counterparts. **If your need is on that list, use the mapping.** Don't re-derive.

### Step 3: If not on the mapping table — query PrimeVue via Context7

```
mcp__MCP_DOCKER__get-library-docs
  context7CompatibleLibraryID: /websites/primevue
  topic: <your component need>
  tokens: 8000
```

Read the returned snippets. PrimeVue 4 ships 80+ components — odds are high something fits.

### Step 4: If PrimeVue has it — use it

- Import the PrimeVue component directly (e.g., `import ContextMenu from "primevue/contextmenu"`).
- Style via `:pt` (passthrough) to match project tokens. Never rely on PrimeVue's bundled styles — the app runs `PrimeVue, { unstyled: true }`.
- If the project's `src/components/ui/*` wrappers cover the use (Button, IconButton, Select, Tooltip, ContextMenu), prefer the wrapper. If they don't, use PrimeVue directly.

### Step 5: If PrimeVue does NOT have it — check the rest of the locked stack

The other libraries already installed (and listed in CLAUDE.md's locked-stack table) cover specific needs:

- **2D maps** → `maplibre-gl`.
- **Geospatial math** → `@turf/*`, `mgrs`, `h3-js`.
- **Icons** → `@lucide/vue` (named imports only).
- **Date math** → `dayjs`.
- **Functional utils** → `es-toolkit` (NOT lodash).

### Step 6: Still nothing fits — surface the gap

If neither PrimeVue nor the locked-stack libraries cover the need, **do not silently invent custom markup**. Surface the gap before writing code:

> "I need [X]. PrimeVue's closest match is [Y] but it doesn't [Z]. None of the locked-stack libraries cover it either. Options: (a) ship a custom build, (b) add a new library, (c) re-scope. Which?"

The user decides.

### Step 7: When custom IS required — document why

If the user approves a custom build, the component's docstring must say:

- What it does.
- Why PrimeVue / the locked stack didn't fit.
- What would have to change for a future swap to be viable.

This prevents future agents from re-evaluating the same trade-off.

## What counts as "custom UI"

Anything in `src/components/**/*.vue` that renders user-interactive markup. Library-first applies to:

- Menus, menubars, context menus, dropdowns
- Dialogs, modals, popovers, drawers
- Tables, lists, grids, data views
- Form controls (input, select, checkbox, radio, color, range, date, file)
- Buttons, icon buttons, toggle buttons
- Tabs, accordions, fieldsets
- Toasts, notifications, badges, chips, tags
- Tooltips, dividers, separators
- Pagination, scrollers, virtual lists

It does NOT apply to:

- Pure layout components (a grid wrapper, a card-shell div)
- Slot-driven framework primitives (`ChromeBar` / `ChromeSlot`)
- Domain components (panels themselves — though their internals follow the rule)

## Adding new mappings to CLAUDE.md

When you discover a useful PrimeVue ↔ project-need mapping that isn't in CLAUDE.md's Common-mappings table, **add it** as part of the PR that introduced the usage. Don't leave the next agent to rediscover it.

## Why this exists

MapForge runs PrimeVue 4 in unstyled mode + Tailwind v4 with a documented passthrough pattern. Hand-rolled components miss out on:

- Accessibility (ARIA roles, keyboard navigation, focus management).
- Positioning logic (popovers, dropdowns, context menus near viewport edges).
- Outside-click handling, escape-to-close, focus trapping.
- Consistent visual language with the rest of the app.
- The maintenance team that built PrimeVue is much larger than ours.
