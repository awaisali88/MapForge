# Changelog

All notable changes to MapForge are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial MapForge scaffold: full-screen MapLibre map (OpenFreeMap, no API key),
  ported tool registry with `measure-distance` and `draw-polygon` tools, drawings
  store + rendering layer, and a starter control overlay (tool toggles, clear
  drawings, basemap switch).
- Meta-infrastructure forked from CommandVue: agent rules, GitHub config, and the
  quality tooling (ESLint, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky).
