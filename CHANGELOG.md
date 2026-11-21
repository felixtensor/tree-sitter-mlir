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

### Fixed
- **grammar:** split bare-enum custom-body braces into a separate hidden
  `_custom_body_enum_brace_group` rule and narrow its GLR conflicts so
  downstream bracket-pair queries such as `("(" @open ")" @close)` compile
  without stalling in `ts_query__analyze_patterns` (no AST changes).

## [0.2.1] - 2026-11-20

Custom-body operation and brace disambiguation, pretty-dialect body
refinements, public AST and editor query alignment, and upstream MLIR corpus
sync.

### Added
- **grammar:** support `module_operation.properties` for both `<{...}>` and
  `<key = value>` custom property-dictionary spellings.
- **grammar:** allow `function_type` in `block_arg_list` and `tuple_dim`, and
  emit named `array_attribute`, `affine_map_inline`, and `custom_body_arrow`
  nodes.

### Fixed
- **scanner:** end custom operation bodies at line-start result bindings or
  unbound generic operations; handle `->` arrows during block-label lookahead;
  keep custom-body `module` symbol arguments (including spaced forms) inside
  their operation without breaking module headers.
- **scanner/grammar:** resolve custom-body `{...}` ambiguity via hybrid brace
  classification — parse `{dotted.key = ...}` as `dictionary_attribute`, parse
  name-only `{...}` after a type inside `(...)` as unit-key argument
  attributes, keep `{%a, %b}`, custom enum braces (e.g. XeVM `extf`/`truncf`),
  and other balanced non-region `{...}` payloads flat, never read `{...}`
  inside `<...>` as a region, and localize unclosed direct fallback braces
  before the next operation or block boundary.
- **grammar:** keep the `constant` modifier inside `memref.global` /
  `llvm.mlir.global` while preserving result-bound default-dialect `constant`
  operations; accept whitespace/comments between property delimiters
  (`< { ... } >`); keep `function_type` on `() -> ()` attribute values (#83).
- **grammar:** require dialect bodies' `<` to touch their name so `!ns<...>`
  and `#ns<...>` stay `dialect_type` / `dialect_attribute` (#82) while spaced
  `<...>` stays separate; support bare `memref`/`tuple`, non-builtin
  `tuple<...>`/`vector<...>`, nested builtin/opaque elements, bare
  dialect-local array elements, and required leading dimensions in
  `dialect_dim_list` (#77); exclude leading whitespace from named nodes inside
  `pretty_dialect_item_body`.
- **grammar:** expose every `op_result` through `operation.lhs`, and restrict
  `func_operation.attributes` and `module_operation.attributes` to the
  attribute node itself.
- **queries:** remove the invalid `@item` capture and dead unnamed-module rule
  from `queries/tags.scm`; align highlight coverage with `attribute_entry`,
  `affine_map_inline`, `custom_body_arrow`, quoted symbol refs, IRDL
  `complex:` labels, `dialect_dim_list`, and pretty-body `.`/`@`/`#` tokens;
  remove redundant captures, add `@indent.end` to `queries/indents.scm`, and
  fold `external_resources` in `queries/folds.scm`.

### Changed
- **examples:** sync the checked-in MLIR corpus to
  `llvm-project@e3f9a6e4b78f` (2026-11-08), mirroring upstream dialect
  subdirectories and retaining module-properties and full-scan regressions
  (712 files).
- **CI/tooling:** install the tree-sitter CLI version resolved by
  `package-lock.json`; validate `queries/tags.scm` with `tree-sitter tags`,
  smoke-test `folds.scm`/`indents.scm`, enforce an allowlist on
  `tree-sitter highlight --check`, and guard `:cst` expectations in
  `scripts/update-tests.mjs`.
- **queries/docs:** highlight `strided` and `distinct` builtin introducers as
  `@constructor.builtin`, remove unused `@function` from `docs/QUERIES.md`, and
  tighten and reconcile `docs/ARCHITECTURE.md` and `docs/QUERIES.md` against
  the current node set and CI gates.
- **bindings:** refresh C/CMake/Makefile, Rust (edition 2024, `tree-sitter`
  0.27.2), Node (Windows relative import and Bun standalone support), Python
  (lazy resource import and sdist globs), Swift (5.6 `Context.packageDirectory`
  and `swift-tree-sitter` 0.10), and Zig templates from `tree-sitter` 0.27.2.

### Breaking AST changes
- `attribute_entry` now exposes `key` (`bare_id` / `string_literal`) and
  optional `value` (`attribute_value`) fields; bracketed attribute arrays emit
  named `array_attribute` nodes; inline prefixless affine maps emit
  `affine_map_inline`; OpenMP `<-` arrows emit `custom_body_arrow` (with
  separate `<` and `-` tokens); `irdl.operands(complex: %0)` emits ordinary
  `bare_id` and `:` tokens.
- `module_operation` adds an optional `properties` field; `properties` exposes
  separate `<`, `{`, `}`, `>` tokens instead of `<{` and `}>`.
- `operation.lhs` labels only `op_result` children (excluding `,` and `=`), and
  `func_operation.attributes` / `module_operation.attributes` no longer label
  the optional `"attributes"` keyword.
- Named nodes inside `pretty_dialect_item_body` no longer include leading
  whitespace in their byte ranges, and standalone `.` runs (e.g. `...` in
  `!llvm.func<void (...)>`) emit anonymous `.` tokens.
- `dialect_dim_list` requires a leading dimension (`N`, `?`, or `*`) before each
  `x`, and `() -> ()` as an `attribute_value` emits a `function_type` child.
- `!ns<...>` / `#ns<...>` in custom bodies stay `dialect_type` /
  `dialect_attribute` when followed by another construct; a `<...>` separated
  by whitespace/comments no longer attaches to a dialect name.
- Line-start result bindings and unbound generic operations after a custom
  operation start a new `operation`; a global's `constant` modifier stays a
  `bare_id` inside its operation (while default-dialect `constant` ops wrap a
  `bare_id` inside `custom_op_name`); custom-body `module(@sym)` emits
  separate `module` and `(` tokens and keeps spaced `module` arguments inside
  the `custom_operation`.
- Custom-body `{...}` shapes changed: `{dotted.key = ...}` and name-only
  `{...}` after a type inside `(...)` emit `attribute` /
  `dictionary_attribute`; `{%a, %b}`, custom enum braces, `{...}` inside
  `<...>`, and other non-region/non-dictionary balanced braces stay flat inside
  the `custom_operation` (no phantom `region` / `operation` subtrees, so
  region-based fold/indent/scope queries no longer match them); malformed
  direct fallback braces may report a sibling `ERROR` or missing close.

### Known limits
- Body-level unit-key braces (e.g. `memref.dealloc %m {test.flag} : ...`) still
  parse as regions; only the operation's assembly format can decide there.

## [0.2.0] - 2026-08-02

Extensible MLIR parser foundations, bounded custom assembly recovery, and
deterministic fuzzing.

### Added
- **grammar:** recognize the builtin `f8E5M3FNU` floating-point type.
- **tests:** protect unknown operation, type, and attribute envelopes; nested
  custom-assembly delimiters; strings containing false boundaries; trailing
  locations; sibling operations; block labels; region closes; and localized
  malformed-payload recovery.
- **tests:** pin direct matches and high-value false positives for all three
  external scanner tokens.
- **tooling/CI:** add a shared `npm run fuzz` entry that rebuilds the parser,
  directly replays a fixed incremental-regression seed, and fuzzes the complete
  corpus with a fresh random seed when parser or fuzz-runner inputs change.

### Fixed
- **scanner:** recognize compact block labels immediately after a region open,
  as in `{^bb0: ...}`, without adding scanner state or new external tokens.
- **grammar:** keep a leading `//` inside a string literal from being tokenized
  as a comment and consuming the following operation or region boundary.
- **grammar:** parse a vector shape as one deterministic dimension list,
  eliminating an incremental-parse inconsistency for mixed static and scalable
  dimensions and removing the obsolete static-dimension self-conflict.

### Changed
- **architecture:** define the operation-first, generic-anchored,
  dialect-open, boundary-preserving, consumer-driven, and evidence-bounded
  parser foundations, including the public AST and scanner contracts.
- **examples:** sync the checked-in MLIR smoke corpus to
  `llvm-project@79537625e213b6a5f329da1d5a443de265346a5e` (2026-07-31).
  The snapshot is a parse gate, not a dialect support matrix or exact AST
  baseline.
- **docs:** avoid treating drifting test or query counts as long-lived parser
  guarantees.

### Breaking AST changes
- Multidimensional vector shapes containing bracketed scalable dimensions now
  emit one `vector_dim_list` containing all `dimension_size` children. They
  previously emitted separate sibling `vector_dim_list` nodes around scalable
  dimension groups, for example in `vector<[2]x[2]xf64>` and
  `vector<2x[4]xbf16>`.

## [0.1.10] - 2026-07-08

Custom assembly dimension-list parsing, LLVM function clause support, and
highlight capture refinements.

### Added
- **grammar:** parse custom-operation body dimension lists as structured
  `custom_body_dim_list` nodes, covering AMDGPU-style static shapes such as
  `16x16x16` and dynamic markers such as `8x?x4`.
- **grammar:** support `llvm.func` post-signature `vscale_range(min, max)`
  and `comdat(@selector)` clauses.

### Fixed
- **scanner:** keep dimension-separator probing from shifting line-start state
  or swallowing a failed `x` probe into a following caret identifier.
- **highlights:** color `llvm.func` `vscale_range` and `comdat` clause
  introducers as keywords.
- **highlights:** color pretty-dialect bare identifiers, builtin introducers,
  affine dimensions, and `func.func` visibility with more specific captures.

### Changed
- **grammar:** split `func_operation` handling for `func.func` and `llvm.func`
  so `func.func` only accepts MLIR symbol visibility before the symbol while
  `llvm.func` keeps LLVM linkage / visibility / calling-convention specifiers.
- **docs:** document the intentional non-standard highlight captures
  `@variable.special` and `@label`.
- **tests:** move custom-assembly corpus coverage into
  `test/corpus/14-custom-assembly.txt`.

### Breaking AST changes
- Custom-operation body dimension-list payloads such as `16x16x16` and
  `8x?x4`, including spaced forms, now emit `custom_body_dim_list` with
  `dimension_size` / `dimension_separator` children instead of flattening as
  loose custom-body tokens.
- `llvm.func` post-signature `vscale_range` and `comdat` clauses now emit named
  `vscale_range` / `comdat` nodes under `func_operation` instead of being
  parsed as separate trailing custom operations.
- `func_operation` now exposes `nested` as a valid `visibility` token for
  `func.func`; LLVM-specific pre-symbol specifiers remain scoped to
  `llvm.func`.

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
- **scanner:** skip string literals when matching a block-label argument
  list, so a bracket inside a string (e.g. `!llvm.struct<")">`) no longer
  misclassifies the block label as a successor.
- **python:** include `src/scanner.c` in the sdist so the wheel and
  from-source builds link the external scanner (previously failed to import
  with `undefined symbol: tree_sitter_mlir_external_scanner_create`).

### Changed
- **highlights:** refine capture channel hierarchy.
- **examples:** sync upstream to `llvm-project@6f9ac38b` (2026-07-02).
  566 files, 176k lines; 0 parse failures. +14 files from the previous
  snapshot, including new SCF, Linalg, and OpenACC test cases.

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

[Unreleased]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.10...v0.2.0
[0.1.10]: https://github.com/felixtensor/tree-sitter-mlir/compare/v0.1.9...v0.1.10
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
