# MLIR tree-sitter queries

These queries use the **standard tree-sitter capture vocabulary** where it fits,
plus a few editor-common extensions where they better describe MLIR semantics.
Captures express a *semantic category*, never a specific theme color.

| File | Purpose | Status |
| --- | --- | --- |
| `queries/highlights.scm` | Syntax highlighting | Active, tested |
| `queries/locals.scm` | Scopes / definitions / references for SSA, block labels, symbols, aliases | Active |
| `queries/tags.scm` | Code navigation tags (named `func`, named `module`) | Active, validated |
| `queries/folds.scm` | Code folding (regions `{ ... }`, external resources `{-# ... #-}`) | Active |
| `queries/indents.scm` | Auto-indentation (`nvim-treesitter` conventions; region-based, block label alignment) | Active |
| `queries/injections.scm` | Language injection | Empty by design |

## Capture vocabulary

`highlights.scm` mostly uses standard tree-sitter highlight captures:

`@comment` `@keyword` `@operator` `@function.builtin`
`@type` `@type.builtin` `@attribute` `@variable.parameter`
`@number` `@boolean` `@string` `@string.escape` `@string.special.symbol`
`@constant.builtin` `@constructor.builtin` `@error`
`@punctuation.bracket` `@punctuation.delimiter` `@punctuation.special`

It also intentionally uses these non-standard editor-common captures:

`@variable.special` for SSA values (falls back to `@variable` in the default
CLI theme) and `@label` for block labels (commonly used in editor ecosystems;
note that the default `tree-sitter highlight` CLI theme defines no color or
fallback for `@label`).

## Highlight capture policy

Capture choices are made from MLIR semantics and tree-sitter-compatible editor
conventions. They do not mirror any specific theme or downstream package.

| MLIR construct | Capture decision |
| --- | --- |
| Operation names (`func.func`, `arith.addi`, generic string ops) | `function.builtin` |
| Builtin `<payload>` attribute/literal introducers (`affine_map`, `affine_set`, `strided`, `distinct`, `dense_resource`, `dense`, `sparse`, `array`) | `constructor.builtin` |
| SSA values (`%arg0`, `%0`) | `variable.special` |
| Symbol-body operators (`+ - * / & \| ~`, OpenMP `<-`) | `operator` |
| Block label (`caret_id`, `^bb0`) | `label` |

The remaining capture choices follow common tree-sitter conventions directly.

## Semantic limits of syntax highlighting

This grammar is dialect-open and does not embed ODS assembly formats. In custom
assembly, a `{...}` can be a discardable attribute dictionary or a region; only
the operation's format decides. Queries must not present an ambiguous name-only
brace as a definite attribute or operation. Consumers needing exact
classification should layer an MLIR-aware tool over tree-sitter, which remains
the fast fallback for incomplete or invalid files. Global prefix or `:`
heuristics were rejected because real regions and attribute dictionaries share
both shapes.

## Language injections

`queries/injections.scm` intentionally contains no active patterns. MLIR IR does
not carry a stable child language inside `.mlir` files, so this grammar does not
inject C++, shell, or any dialect-specific DSL from MLIR string literals.

The inverse case is the useful one: host languages can inject MLIR. For example,
C++ grammars can inject MLIR from raw-string delimiters such as
`R"mlir(...)mlir"`. That behavior belongs to the host grammar, while this
grammar only needs to register the `mlir` language and keep its own injection
query inert.

## Verifying

```sh
# Highlight assertions (`// ^ capture` comments under test/highlight/**)
tree-sitter test

# Visual check of one file
tree-sitter highlight path/to/file.mlir

# Verify query validity and surface any non-standard captures. The current
# @variable.special and @label warnings are intentional.
# Pin the query with --query-paths for reproducible results, but keep it
# *after* the source paths: --query-paths is variadic and would otherwise
# swallow them.
tree-sitter highlight --check path/to/file.mlir --query-paths queries/highlights.scm

# Validate tags.scm against tree-sitter-tags capture rules
tree-sitter tags path/to/file.mlir

# Verify query captures (adjust query and file path as needed)
tree-sitter query queries/tags.scm path/to/file.mlir
tree-sitter query queries/folds.scm path/to/file.mlir
tree-sitter query queries/indents.scm path/to/file.mlir
tree-sitter query queries/locals.scm path/to/file.mlir
tree-sitter query queries/injections.scm path/to/file.mlir
```

Every `highlights.scm` capture is exercised by fixtures under
`test/highlight/**`, grouped by syntax area. Exact fixture counts are not a
long-lived query contract.
