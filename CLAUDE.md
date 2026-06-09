# MapForge — Claude Code / Agent Instructions

This file is read by Claude Code and other AI coding agents at the start of every session. It defines the project's stack, conventions, and rules so agents produce consistent, high-quality code.

The full ruleset is split into focused modules under [`.agent/rules/`](./.agent/rules) and imported below. Claude Code expands every `@import` inline at session start, so the complete ruleset still loads as one — this split is for maintainability. **Edit the relevant module, and keep the import list below in sync when you add or remove one.**

---

## Rule modules

**Project & stack** — what MapForge is, the locked technology stack, the "don't add" list, brand colors:
@./.agent/rules/project-and-stack.md

**UI & components** — library-first / PrimeVue-first rules, the component mapping table, icons, styling:
@./.agent/rules/ui-and-components.md

**Architecture & conventions** — the map composable + tool registry + drawings/geo model, state, file & testing conventions:
@./.agent/rules/architecture.md

**Git & workflow** — commit conventions, branch/PR conventions:
@./.agent/rules/git-workflow.md

**Verification** — runtime verification after major version bumps, the `vue-tsc` cache gotcha, the two-stage verification protocol:
@./.agent/rules/verification.md

**Libraries, gotchas & knowledge** — Context7-first rule, MapLibre/Lucide notes, the documentation-sync table, the memory surfaces:
@./.agent/rules/libraries-and-knowledge.md
