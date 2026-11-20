# MLIR tree-sitter queries

All shipped queries follow the **standard tree-sitter capture vocabulary** where
it fits, plus two editor-common extensions for MLIR semantics. Captures denote
semantic roles, not theme colors.

| File | Purpose | Status |
| --- | --- | --- |
| `queries/highlights.scm` | Syntax highlighting | Active, tested |
| `queries/locals.scm` | Scopes, definitions, and references (SSA, block labels, symbols, aliases) | Active, compile-checked |
| `queries/tags.scm` | Code navigation tags (named `func`, named `module`) | Active, validated |
| `queries/folds.scm` | Code folding (`region`, `external_resources`) | Active, smoke-tested |
| `queries/indents.scm` | Auto-indentation (`nvim-treesitter` conventions) | Active, smoke-tested |
| `queries/injections.scm` | Language injection | Intentionally empty |

## Capture Vocabulary

Standard captures used in `queries/highlights.scm`:

`@comment` `@keyword` `@operator` `@function.builtin`
`@type` `@type.builtin` `@attribute` `@variable.parameter`
`@number` `@boolean` `@string` `@string.escape` `@string.special.symbol`
`@constant.builtin` `@constructor.builtin` `@error`
`@punctuation.bracket` `@punctuation.delimiter` `@punctuation.special`

Intentional editor-common extensions (allowlisted in CI):

- `@variable.special` — SSA values (`%arg0`, `%0`); falls back to `@variable` in
  the default CLI theme.
- `@label` — block labels (`^bb0`); widely supported by editors (no default
  color in the `tree-sitter highlight` CLI theme).

## Highlight Capture Policy

| MLIR construct | Capture |
| --- | --- |
| Operation names (`func.func`, `arith.addi`, generic string ops) | `@function.builtin` |
| Builtin `<payload>` introducers (`affine_map`, `affine_set`, `strided`, `distinct`, `dense_resource`, `dense`, `sparse`, `array`) | `@constructor.builtin` |
| SSA values (`%arg0`, `%0`) | `@variable.special` |
| Custom-body operators (`+ - * / & \| ~`, OpenMP `<-`) | `@operator` |
| Block labels (`caret_id`, `^bb0`) | `@label` |

All other constructs follow standard tree-sitter conventions.

## Semantic Limits

Because this grammar is dialect-open and does not embed ODS assembly formats, a
custom-body `{...}` can be either a region or a discardable attribute
dictionary. Queries avoid guessing on ambiguous name-only braces; consumers
requiring exact ODS-level classification should layer an MLIR-aware tool over
tree-sitter.

## Language Injections

`queries/injections.scm` is intentionally empty: `.mlir` files do not embed a
stable child language. The reverse—embedding MLIR inside C++ raw strings such as
`R"mlir(...)mlir"`—belongs in the host language's injection query, while this
grammar registers the `mlir` language and keeps its own injection query inert.

## Verification

```sh
# Corpus + highlight assertions (`// ^ capture` under test/highlight/**)
tree-sitter test

# Visual check on one file
tree-sitter highlight path/to/file.mlir

# Validate highlight captures (keep --query-paths *after* source paths; it is variadic)
tree-sitter highlight --check path/to/file.mlir --query-paths queries/highlights.scm

# Validate tags.scm against tree-sitter-tags rules
tree-sitter tags path/to/file.mlir

# Compile and inspect query captures
for q in queries/tags.scm queries/folds.scm queries/indents.scm queries/locals.scm queries/injections.scm; do
  tree-sitter query "$q" path/to/file.mlir
done
```

Every capture in `queries/highlights.scm` is covered by `test/highlight/**`.
