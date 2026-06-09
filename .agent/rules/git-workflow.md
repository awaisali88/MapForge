# Git & workflow

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Commit conventions

Conventional Commits, enforced by commitlint:

- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`

Header max length is 100 (matches Prettier's `printWidth`).

---

## Branch and workflow conventions

MapForge follows a GitFlow-style workflow. **No git remote and no branch protection exist yet** — the repo is a fresh local `main`. The conventions below are carried over from the CommandVue template so they're ready when a remote is added; until then, treat them as the intended shape, not enforced gates.

- **Don't commit directly to `main`** once real history exists — branch first. Conventional branch naming mirrors the commit prefix: `feat/...`, `fix/...`, `docs/...`, `refactor/...`, `chore/...`.
- **One branch per logical unit of work.**
- **When a remote exists,** feature work targets `develop`; release PRs target `main`; PR titles follow Conventional Commits. Add branch protection + the CI/CSpell required checks at that point.

### The required sequence (once a remote exists)

```bash
git checkout develop && git pull origin develop
git checkout -b <type>/<short-slug>
# … edit, commit (lint-staged + commitlint hooks run automatically) …
git push -u origin <type>/<short-slug>
gh pr create --base develop --title "<conventional-commit-style>" --body "<summary + test plan>"
# Stop and wait for the user to merge. Do not auto-merge.
```

### Critical "don'ts"

- **Never amend a published commit** or force-push a shared branch.
- **Never auto-merge** a PR without the user's go-ahead.
- If you accidentally edit a protected branch: `git checkout -b <type>/<slug>` carries your changes to a feature branch; commit/push/PR from there.

End agent commit messages with the `Co-Authored-By: Claude …` trailer.
