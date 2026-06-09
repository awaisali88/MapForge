# Verification

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Runtime verification (mandatory after major-version bumps)

The static gauntlet (`pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build`) does **not** prove a major-version migration is safe. All can pass while the running app is broken in ways that only surface when components mount in the browser.

**After any major-version bump** of a UI framework, build tool, state library, or the map library:

1. Run `pnpm dev` and confirm the map mounts + key flows work (activate a tool, draw, clear, switch basemap). Drive verification with the **Playwright MCP** server (`mcp__plugin_playwright_playwright__*`) when possible; otherwise ask the user to verify manually.
2. Exercise **every surface that uses the bumped library** — runtime regressions are mount-specific.
3. Watch for these failure modes:
   - **Vite `optimizeDeps` failures** — `Cannot optimize dependency: X`, pre-bundle vs raw-serve interop.
   - **Vue `inject` regressions** with functional components (the Lucide 1.16 / Vue 3.5 `LUCIDE_CONTEXT` bug — `main.ts` provides an empty context to satisfy it; keep that provide).
   - **ESM ↔ CJS interop mismatches** — a `.d.ts` claims a named export the ESM module doesn't provide.
   - **MapLibre lifecycle** — adding sources/layers before `style.load`, or after `setStyle` wipes them (re-add on `styledata`; see `useDrawingLayer`).
4. When CI is green but the page doesn't mount, the relevant tooling is **browser console + dev-server stderr**, not the build log.

**Do not** report a migration complete until the running app has been clicked through.

---

## Type-checking — don't trust a cached `vue-tsc` pass

`pnpm type-check` runs `vue-tsc --build`, which caches results in `node_modules/.tmp/*.tsbuildinfo`. That incremental cache can report a **clean pass while the committed code has a real type error** — and `--build --force` does not reliably bust it. CI runs cache-free and catches it.

When a type-check result is load-bearing — before claiming a PR is green — make it cache-free first:

```powershell
Get-ChildItem -Recurse -Filter *.tsbuildinfo | Remove-Item -Force; pnpm type-check
```

…or just trust CI's clean run over a local green.

---

## Verification protocol — automated + human review

Every substantial change ends with two verification stages, in order:

1. **Automated functional verification** — drive a real browser (Playwright MCP) through the change and assert on observable state (DOM attributes, console output, screenshots at named checkpoints). Binary pass/fail; no design judgment. Do not open a PR / claim done until this is green. Screenshots go to `.verification-screenshots/<branch>/<checkpoint>.png` (gitignored).
2. **Human design review** — a short GitHub-markdown task-list (`- [ ]`, 3–7 items) of subjective checks automation can't make (map fills viewport, control overlay legible/positioned, tool affordances clear, drawings visually distinct), plus a final `- [ ] Ready to merge`. The maintainer ticks each box and merges only when all are checked.

**Tool availability:** probe for `mcp__plugin_playwright_playwright__*`; if missing, run `ToolSearch` with `query: "playwright browser"`. If still unavailable, fall back to a manual smoke-test checklist and state so explicitly.
