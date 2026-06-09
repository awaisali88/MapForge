# .agent — AI Agent Configuration

This directory holds configuration and reference material for AI coding agents working on MapForge.

## Rules

High-level, always-on rules live in [`CLAUDE.md`](../CLAUDE.md) at the repo root, which `@import`s the focused modules under [`rules/`](./rules):

| Module                             | Covers                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `rules/project-and-stack.md`       | What MapForge is, the locked technology stack, the "don't add" list               |
| `rules/ui-and-components.md`       | Library-first / PrimeVue-first rules, the component mapping table, icons, styling |
| `rules/architecture.md`            | Map composable + tool registry + drawings/geo model, state & file conventions     |
| `rules/git-workflow.md`            | Conventional Commits, branch/PR conventions                                       |
| `rules/verification.md`            | Two-stage verification protocol, the vue-tsc cache gotcha                         |
| `rules/libraries-and-knowledge.md` | Context7-first rule, documentation-sync, memory surfaces                          |

## Workflows

| File                              | Purpose                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `workflows/library-first.md`      | How to check for a pre-built component before hand-rolling UI                 |
| `workflows/documentation-sync.md` | "When I change X, what else do I update?" Read before any non-trivial change. |

## Adding skills

When MapForge grows a subsystem worth documenting for agents (e.g. a map-tools skill or the future plugin module), add a skill under `.agent/skills/<name>/` with a `SKILL.md` and optional `reference/*`. None exist yet — they are authored as those subsystems are built.

## Canonical guidance

For rules that apply to all agents in all sessions, see [`CLAUDE.md`](../CLAUDE.md) at the repo root.
