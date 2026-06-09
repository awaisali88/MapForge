/**
 * lint-staged runs on staged files via Husky's pre-commit hook.
 *
 * Order matters: ESLint runs first with --fix so it can apply autofixes,
 * then Prettier runs to enforce final formatting.
 */
export default {
  "*.{ts,mts,tsx,js,mjs,cjs,vue}": ["eslint --fix --cache", "prettier --write"],
  "*.{md,json,jsonc,yml,yaml,html,css}": ["prettier --write"],
};
