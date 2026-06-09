# Libraries, gotchas & knowledge

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Library integration — Context7 first

**Mandatory rule, no exceptions:** Before writing, modifying, or debugging any code that integrates a third-party library, framework, SDK, CLI tool, or cloud service, fetch current docs via the **Context7 MCP** server. Use `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`. **Never** rely on training-data knowledge or blog posts older than ~6 months.

This applies to: integrating a new package, bumping a major version, debugging a runtime error that names a library (e.g. `maplibre-gl`, `<Lucide Icon>`, PrimeVue), and acting on any tutorial/blog link the user shares. It does **not** apply to refactoring our own code, writing scripts from scratch, or debugging business logic.

Full rationale + decision matrix lives in [`.agent/workflows/documentation-sync.md`](../workflows/documentation-sync.md).

---

## Library-specific notes (do not regress)

### MapLibre GL

- **The map instance lives in a `shallowRef`, never reactive state** (`useMapLibre`). Reactive proxies break the engine.
- **Adding sources/layers requires the style to be loaded.** Add on the `load` event (fires once). `setStyle` (basemap switch) wipes all sources/layers — re-add yours on `styledata` (see `useDrawingLayer`). Guard adds with `getSource(id)` checks so they're idempotent.
- **Default style is OpenFreeMap Liberty** — community-run, no API key. For air-gapped use, host your own style.json and point `VITE_MAPLIBRE_STYLE_URL` at it; `modules/maplibre/styles.ts` also exports an `OFFLINE_STUB_STYLE` fallback.

### @lucide/vue

- `<Icon>` is a functional component that calls `inject(LUCIDE_CONTEXT)` on render. `main.ts` calls `app.provide(LUCIDE_CONTEXT, {})` at the root so the destructure inside the icon doesn't throw. Keep that provide.

---

## Keeping documentation in sync

The canonical reference for "when I change X, what else do I update" is [`.agent/workflows/documentation-sync.md`](../workflows/documentation-sync.md). Consult it before any non-trivial change and apply the relevant updates in the same PR. The short version:

- **Integrating / bumping / debugging a library** → fetch current docs via Context7 MCP.
- **New / removed dependency** → update `README.md` Stack table **and** the locked-stack table in [`project-and-stack.md`](./project-and-stack.md).
- **New / renamed / removed `pnpm` script** → update `README.md` Scripts table.
- **New environment variable** → update `README.md` Configuration table, `.env.example`, and `docs/` if user-facing.
- **New tool** → add under `src/modules/tools/`, export from `src/modules/tools/index.ts` (`TOOLS`).
- **New `docs/*.md` page** → register in `docs/.vitepress/config.ts` sidebar.
- **CSpell-flagged term** → add to `dictionaries/{operations,project,tech}.txt`, never to `cspell.json`.

## Agent memory

This project uses claude-mem. Observations flow automatically through its hooks; no manual writes needed in worker runtime. After a major change that should be searchable, the corpus name is `mapforge`. The session memory path is `~/.claude/projects/D--Work-UraanAI-Public-MapForge/`.
