# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **0.x parse-tree stability.** Before 1.0 the parse-tree (AST) shape is not
> guaranteed stable across releases. Any change that alters the shape of the
> tree — even when the input still parses without error — is called out in a
> dedicated **Breaking AST changes** subsection so query and binding consumers
> can audit it.

## [Unreleased]

## [0.1.9] - 2026-07-02

Highlights channel sync and a significant block-label correctness fix.

### Added
- First external scanner (`src/scanner.c`, stateless) for caret identifiers.

### Fixed
- **grammar:** disambiguate block labels from successors. MLIR reuses
  `^suffix` for both; the old greedy `successor` rule silently absorbed a
  following block label as a phantom successor, flattening whole regions
  while still parsing without any `ERROR`. 120 of 552 committed examples now
  parse to their correct tree (concentrated in LLVMIR, OpenACC, IR).

### Changed
- **highlights:** refine capture channel hierarchy.

### Breaking AST changes
- A `^bb` label at the start of a block is no longer captured inside the
  preceding operation's `successor`; it now yields the correct
  `block` / `block_label`. Successor and block-label carets both remain
  `caret_id` nodes.
- The anonymous `^` token is removed from the node set (folded into the
  scanner-produced `caret_id`).

## [0.1.8] - 2026-06-30

### Added
- Support for the builtin `token` type.

### Changed
- Publish crates.io and PyPI via OIDC trusted publishing.
- CI verifies that every query file compiles against the grammar.

### Removed
- Local benchmark tooling and the `examples/` AST-surface manifest
  (`bench.mjs`, `scripts/bench/`, `bench/ast-manifest.json`).

## [0.1.7] - 2026-06-27

### Added
- Query ecosystem: `locals.scm` (SSA / symbol / alias tracking), `tags.scm`
  (outline), `folds.scm` and `indents.scm` (region-based).
- `docs/ARCHITECTURE.md` with per-conflict rationale; `docs/QUERIES.md`
  capture policy.

### Changed
- Keep MLIR `injections.scm` intentionally inert.

### Fixed
- Constrain the indent query branch to regions.

## [0.1.6] - 2026-06-14

### Added
- Broad highlight coverage: generic op names, affine level/symbol keywords,
  custom-body operators / keywords / locations, dense-resource captures,
  function specifiers, string escape sequences, metadata delimiters, GPU
  launch symbols, and more.

### Fixed
- Scope bare-id keywords correctly in highlights.
- Pin native build node-gyp; align npm peer-dependency handling.

## [0.1.5] - 2026-06-12

### Changed
- Grammar architecture refactor of the custom-operation body: flattened
  tiers, grouped dialect-payload fallbacks, isolated brace payloads, and
  narrowed declared-conflict owners.

## [0.1.4] - 2026-06-11

### Added
- Benchmark tooling and an `examples/` AST-surface manifest gate on PRs
  (later removed in 0.1.8).

### Fixed
- Parse GPU launch kernel attributes, custom-op ellipsis markers, resource
  metadata, and PDLInterp location lists.

## [0.1.3] - 2026-06-07

### Fixed
- Numerous custom-body and dialect parse gaps: braced SSA tuple groups and
  NUL whitespace, custom-op location attributes, comment-only files, WasmSSA
  successor markers, Transform option dictionaries, IRDL operand labels,
  OpenMP mapped-from arrow, sparse operand markers, the `tensor` keyword in
  custom bodies, and SSA-valued custom dictionaries.

## [0.1.2] - 2026-06-05

### Fixed
- Parse distinct builtin attributes, nested array attribute values, and LLVM
  dialect linkage / calling-convention / nested visibility.

### Changed
- Add a release version gate and align package manifests in CI.

## [0.1.1] - 2026-06-03

### Fixed
- Parse OpenACC braced value groups and vector keywords, empty region
  blocks, dynamic dimension lists in custom-op bodies, and `?` in pretty
  dialect attribute bodies.

### Changed
- Switch npm release to trusted publishing; scoped npm package.

## [0.1.0] - 2026-06-02

Initial public release.

### Added
- MLIR grammar for tree-sitter: builtin types, attributes, source
  locations, operation properties, pretty dialect bodies, and a custom
  operation fallback.
- `highlights.scm` query.
- C, Go, Node, Python, Rust, Swift, and Zig bindings.
- Tag-triggered release workflow for npm, crates.io, and PyPI.

### Breaking AST changes
- `string_literal` made structural: escape sequences are now visible
  `escape_sequence` / `invalid_escape` nodes rather than opaque token text.

[Unreleased]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.9...HEAD
[0.1.9]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/felixtensor/tree-sitter-mlir/releases/tag/v0.1.0
