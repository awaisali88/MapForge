import type { UserConfig } from "@commitlint/types";

/**
 * Conventional Commits enforcement for MapForge.
 *
 * The allowed `type-enum` mirrors the list documented in `CONTRIBUTING.md`.
 * Header length is bumped to 100 to match Prettier's `printWidth`.
 */
const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "test", "build", "ci", "perf", "style", "revert"],
    ],
    "body-max-line-length": [1, "always", 120],
  },
};

export default config;
