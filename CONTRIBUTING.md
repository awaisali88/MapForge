# Contributing to MapForge

Thanks for your interest. MapForge is a **sandbox repository** — its job is to build and test map tools (drawing, measuring, future tools) on MapLibre GL and to develop a future plugin module for CommandVue. We accept contributions that improve the sandbox itself (better defaults, missing wiring, doc clarity, dependency bumps, accessibility fixes). We do not accept product-specific features.

## Quick start for contributors

```bash
git clone https://github.com/uraanai/MapForge.git
cd MapForge
pnpm install
pnpm dev
```

Required: Node ≥ 22.12, pnpm 10.x.

## Quality gates

Before opening a PR, all of these must pass:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm spell
pnpm build
pnpm docs:build    # ~3s; catches broken sidebar entries and dead links
```

CI runs them automatically on every PR. The `pnpm spell` step uses the dictionaries under `dictionaries/`. If you introduce a new term, add it to the appropriate dictionary file rather than to `cspell.json`.

### Adding a documentation page

The `docs/` tree is published as a VitePress site (`pnpm docs:dev` for a live preview). When you add a new page:

1. Create the `.md` file under `docs/`.
2. Register it in the sidebar at [`docs/.vitepress/config.ts`](./docs/.vitepress/config.ts) so it appears in the nav.
3. Cross-link from any related page that already exists.
4. Run `pnpm docs:build` to verify the link graph.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/), enforced by `@commitlint/config-conventional` via the `commit-msg` Husky hook:

- `feat:` a new feature
- `fix:` a bug fix
- `chore:` tooling / housekeeping
- `docs:` documentation only
- `refactor:` code change with no functional difference
- `test:` test-only change
- `build:` build system or external dependencies
- `ci:` CI configuration
- `perf:` performance improvement
- `style:` formatting only

Example: `feat(tools): add polygon-select tool`.

## Branch strategy

MapForge uses a GitFlow-style workflow:

| Branch                                               | Purpose                                             | Receives PRs from            |
| ---------------------------------------------------- | --------------------------------------------------- | ---------------------------- |
| `main`                                               | Protected. Release-only. Tagged versions live here. | `develop` (release PRs only) |
| `develop`                                            | Long-lived integration branch. Day-to-day target.   | Feature branches             |
| `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*` | Short-lived work branches                           | (branch off `develop`)       |

### Day-to-day workflow

```bash
git checkout develop
git pull origin develop
git checkout -b feat/my-feature

# do work, commit using Conventional Commits

git push -u origin feat/my-feature
gh pr create --base develop --title "feat: my feature" --body "..."
```

After review and CI green, merge to `develop`. The branch auto-deletes after merge.

### Release workflow

When `develop` is stable and ready to ship:

```bash
git checkout develop
git pull origin develop
gh pr create --base main --title "release: <version>" --body "<changelog summary>"
# After merge:
git checkout main
git pull origin main
git tag -a v<version> -m "<release notes>"
git push origin v<version>
```

### Branch protection summary

- **`main`**: requires CI (`Lint · Type-check · Test · Build`) and `CSpell` passing, linear history, `enforce_admins: true`, no force-push, no deletion, conversation resolution required. Squash-merge only.
- **`develop`**: requires the same status checks passing, no force-push, no deletion. Merge commits allowed (preserves PR boundaries during integration).
- Self-merge is permitted on both branches because the project currently has one active maintainer. Reviewer discipline is by convention.

## Coding rules

The full project guidelines live in [`CLAUDE.md`](./CLAUDE.md) — read that first. Highlights:

- **No `any` types.** Use proper generics or `unknown` + narrowing.
- **No `console.log` in committed code.** Use the logger utility if needed.
- **All composables clean up on unmount.** No leaked listeners, no leaked viewers.
- **MapLibre instances live in `shallowRef`, never reactive state.**
- **Pinia stores hold serializable state only** — no DOM refs, no MapLibre objects.
- **Tailwind utilities for layout/spacing** — no scoped styles for these concerns.
- **Tokens in `src/assets/styles/tokens.css`** — do not hardcode hex values in components.

## UI primitives

> UI conventions (PrimeVue-first, the ui/\* wrappers) live in .agent/rules/ui-and-components.md.

## Reporting bugs / requesting features

Use the GitHub issue templates under [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/). Include repro steps, expected vs actual behavior, and the output of `pnpm --version && node --version`.

## Security

Do not file security issues on the public tracker. See [`SECURITY.md`](./SECURITY.md) for the reporting address and our handling commitment.

## Code of conduct

Participation in this project is governed by the [Contributor Covenant 3.0](./CODE_OF_CONDUCT.md). Be kind; assume good faith; report violations to conduct@uraanai.com (see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) for the full reporting and enforcement process).

## License of contributions

MapForge is licensed under the [Apache License, Version 2.0](./LICENSE). By submitting a pull request or any other contribution to this repository, you agree that your contribution is provided under the same Apache 2.0 terms (as described in Section 5, "Submission of Contributions" of the license). No separate Contributor License Agreement (CLA) is required — the Apache 2.0 inbound-equals-outbound model applies.

If your contribution includes third-party code, ensure it is compatible with Apache 2.0 (e.g., MIT, BSD, ISC, Apache 2.0). Call out any such inclusions explicitly in your PR description and preserve their original copyright and license notices.
