# MLIR tree-sitter queries

These queries target the **standard tree-sitter capture vocabulary** so that
Neovim (nvim-treesitter), Helix, Emacs, Zed, and other consumers can all map
them through their own theme. Captures express a *semantic category*, never a
specific theme color.

| File | Purpose | Status |
| --- | --- | --- |
| `queries/highlights.scm` | Syntax highlighting | Active, tested |
| `queries/locals.scm` | Scopes / definitions / references for SSA, block labels, symbols, aliases | Active |
| `queries/tags.scm` | Outline / code navigation (func, module, block label) | Active |
| `queries/folds.scm` | Code folding (region `{ ... }`) | Active |
| `queries/indents.scm` | Auto-indentation (region-based, block label alignment) | Active |
| `queries/injections.scm` | Language injection | Empty by design |

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

## Language injections

`queries/injections.scm` intentionally contains no active patterns. MLIR IR does
not carry a stable child language inside `.mlir` files, so this grammar does not
inject C++, shell, or any dialect-specific DSL from MLIR string literals.

The inverse case is the useful one: host languages can inject MLIR. For example,
Zed's bundled C++ grammar has been verified to highlight `R"mlir(...)mlir"` raw
strings by using the raw-string delimiter as the injected language name. That
behavior belongs to the C++ grammar, while this grammar only needs to register
the `mlir` language and keep its own injection query inert.

## Verifying

```sh
# Highlight assertions (`; ^ @capture` comments under test/highlight/**)
tree-sitter test

# Visual check of one file
tree-sitter highlight path/to/file.mlir

# Verify query captures (adjust query and file path as needed)
tree-sitter query queries/tags.scm path/to/file.mlir
tree-sitter query queries/folds.scm path/to/file.mlir
tree-sitter query queries/indents.scm path/to/file.mlir
tree-sitter query queries/locals.scm path/to/file.mlir
tree-sitter query queries/injections.scm path/to/file.mlir
```

Every `highlights.scm` capture is exercised by `test/highlight/**` (23 files,
grouped under `types/`, `core/`, `integration/`, `assembly/`, `attributes/`).
