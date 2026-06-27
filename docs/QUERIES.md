# MLIR tree-sitter queries

These queries target the **standard tree-sitter capture vocabulary** so that
Neovim (nvim-treesitter), Helix, Emacs, and other consumers can all map them
through their own theme. Captures express a *semantic category*, never a
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

## Highlight capture policy

Capture choices are made from MLIR semantics and the standard tree-sitter
vocabulary. They do not mirror any editor-specific theme or downstream package.

| MLIR construct | Capture decision |
| --- | --- | --- |
| Operation names (`func.func`, `arith.addi`, generic string ops) | `function.builtin` |
| SSA values (`%arg0`, `%0`) | `variable` / `variable.parameter` |
| Symbol-body operators (`+ - * / & \| ~`) | `operator` |
| Block label (`caret_id`, `^bb0`) | `tag` |

The remaining capture choices follow common tree-sitter conventions directly.

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
# Highlight assertions (`; ^ @capture` comments under test/highlight/**)
tree-sitter test

# Visual check of one file
tree-sitter highlight path/to/file.mlir

# Verify highlight captures against tree-sitter's standard capture vocabulary.
# Keep --query-paths explicit so local/editor query paths do not affect results.
tree-sitter highlight --check --query-paths queries/highlights.scm path/to/file.mlir

# Verify query captures (adjust query and file path as needed)
tree-sitter query queries/tags.scm path/to/file.mlir
tree-sitter query queries/folds.scm path/to/file.mlir
tree-sitter query queries/indents.scm path/to/file.mlir
tree-sitter query queries/locals.scm path/to/file.mlir
tree-sitter query queries/injections.scm path/to/file.mlir
```

Every `highlights.scm` capture is exercised by `test/highlight/**` (23 files,
grouped under `types/`, `core/`, `integration/`, `assembly/`, `attributes/`).
