# MLIR tree-sitter queries

These queries use the **standard tree-sitter capture vocabulary** where it fits,
plus a few editor-common extensions where they better describe MLIR semantics.
Captures express a *semantic category*, never a specific theme color.

| File | Purpose | Status |
| --- | --- | --- |
| `queries/highlights.scm` | Syntax highlighting | Active, tested |
| `queries/locals.scm` | Scopes / definitions / references for SSA, block labels, symbols, aliases | Active |
| `queries/tags.scm` | Outline / code navigation (func, module, block label) | Active |
| `queries/folds.scm` | Code folding (region `{ ... }`) | Active |
| `queries/indents.scm` | Auto-indentation (region-based, block label alignment) | Active |
| `queries/injections.scm` | Language injection | Empty by design |

## Capture vocabulary

`highlights.scm` mostly uses standard tree-sitter highlight captures:

`@comment` `@keyword` `@operator` `@function` `@function.builtin`
`@type` `@type.builtin` `@attribute` `@variable.parameter`
`@number` `@boolean` `@string` `@string.escape` `@string.special.symbol`
`@constant.builtin` `@constructor.builtin` `@error`
`@punctuation.bracket` `@punctuation.delimiter` `@punctuation.special`

It also intentionally uses these non-standard style captures:

`@variable.special` for SSA values and `@label` for block labels.

## Highlight capture policy

Capture choices are made from MLIR semantics and tree-sitter-compatible editor
conventions. They do not mirror any specific theme or downstream package.

| MLIR construct | Capture decision |
| --- | --- |
| Operation names (`func.func`, `arith.addi`, generic string ops) | `function.builtin` |
| SSA values (`%arg0`, `%0`) | `variable.special` |
| Symbol-body operators (`+ - * / & \| ~`) | `operator` |
| Block label (`caret_id`, `^bb0`) | `label` |

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

# Verify query validity and surface any non-standard captures. The current
# @variable.special and @label warnings are intentional.
# Pin the query with --query-paths for reproducible results, but keep it
# *after* the source paths: --query-paths is variadic and would otherwise
# swallow them.
tree-sitter highlight --check path/to/file.mlir --query-paths queries/highlights.scm

# Verify query captures (adjust query and file path as needed)
tree-sitter query queries/tags.scm path/to/file.mlir
tree-sitter query queries/folds.scm path/to/file.mlir
tree-sitter query queries/indents.scm path/to/file.mlir
tree-sitter query queries/locals.scm path/to/file.mlir
tree-sitter query queries/injections.scm path/to/file.mlir
```

Every `highlights.scm` capture is exercised by `test/highlight/**` (24 files,
grouped under `types/`, `core/`, `integration/`, `assembly/`, `attributes/`).
