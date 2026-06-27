# MLIR tree-sitter queries

These queries target the **standard tree-sitter capture vocabulary** so that
Neovim (nvim-treesitter), Helix, Emacs, Zed, and other consumers can all map
them through their own theme. Captures express a *semantic category*, never a
specific theme color.

| File | Purpose | Status |
| --- | --- | --- |
| `queries/highlights.scm` | Syntax highlighting | Active, tested |
| `queries/locals.scm` | Scopes / definitions / references for SSA values, block args, symbols, aliases | Active, query-tested |
| `queries/injections.scm` | Language injection | Documented-only (see below) |

`tags.scm`, `folds.scm`, and `indents.scm` are intentionally **not** shipped
yet — see the Phase 4 plan.

## Capture vocabulary

`highlights.scm` uses only these standard captures:

`@comment` `@keyword` `@operator` `@function` `@function.builtin`
`@type` `@type.builtin` `@attribute` `@variable` `@variable.parameter`
`@number` `@boolean` `@string` `@string.escape` `@string.special.symbol`
`@constant.builtin` `@tag` `@error`
`@punctuation.bracket` `@punctuation.delimiter` `@punctuation.special`

## Zed calibration record (one-way reference, no back-port)

`zed-mlir-suite` is treated as a *coloring-intent* reference, **not** a golden
source. Zed exposes some capture channels that differ from the names the
tree-sitter CLI and the broader editor ecosystem recognize. Where they differ,
this grammar uses the standard name and records the mapping here. Aligning
`zed-mlir-suite` back to this grammar is out of scope for v0.1.x (a separate
repo's concern).

| MLIR construct | Zed-style channel | Standard capture used here |
| --- | --- | --- |
| Symbol-body operators (`+ - * / & \| ~`) | `keyword.operator` | `operator` |
| Malformed string escape (`invalid_escape`) | `warning` | `error` |
| Block label (`caret_id`, `^bb0`) | `label` | `tag` |

The remaining capture choices follow common tree-sitter conventions directly and
needed no Zed-specific remapping.

## Verifying

```sh
# Highlight assertions (`; ^ @capture` comments under test/highlight/**)
tree-sitter test

# Visual check of one file
tree-sitter highlight path/to/file.mlir

# Verify locals captures
tree-sitter query --test queries/locals.scm test/query/locals.mlir
```

Every `highlights.scm` capture is exercised by `test/highlight/**` (23 files,
grouped under `types/`, `core/`, `integration/`, `assembly/`, `attributes/`).
`test/query/locals.mlir` exercises every `locals.scm` capture pattern:
toplevel and region scopes, SSA definitions and references, function arguments,
block labels and arguments, symbol definitions and references, and type /
attribute alias definitions and references. Query changes must ship with a
runnable `tree-sitter test` assertion or a `tree-sitter query` verification
command — eyeballing editor colors does not count as coverage.
