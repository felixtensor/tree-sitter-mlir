# Architecture

This document describes the parser's design decisions that a contributor
needs to understand before changing the grammar, queries, or bindings.
It is **not** a changelog or a project status report.

The executable correctness gate is `bench/ast-manifest.json` (run with
`node bench.mjs --verify`). This document explains what that gate is
protecting and why.

## Public AST Surface

These named nodes and fields are the stable contract consumed by queries,
editor integrations, and language bindings. **Do not rename or remove any
of them without an explicit review.**

When a node appears here, it is expected to keep the same name, parent
relationship, and field structure across grammar changes. The AST manifest
(`bench/ast-manifest.json`) will flag accidental shape changes, but the
review decision still belongs in the grammar or query commit that needs
the change.

Helper rules prefixed with `_` (e.g. `_custom_body_*`, `_pretty_dialect_*`)
are implementation detail and are **not** part of this surface.

### Top-Level and Operations

| Node | Key fields / children |
| --- | --- |
| `toplevel` | contains `operation`, `attribute_alias_def`, `type_alias_def`, `external_resources` |
| `operation` | `lhs`, `rhs`, `location` |
| `custom_operation` | `name`; for `affine.for`, also `induction_location` |
| `custom_op_name` | bare identifier or dotted name that selects the dialect operation |
| `generic_operation` | quoted generic MLIR form (`"dialect.op"`) |
| `func_operation` | `name`, `visibility`, `specifier`, `sym_name`, `arguments`, `return`, `attributes`, `body` |
| `function_specifier` | linkage / calling-convention / visibility keyword inside `func_operation` |
| `module_operation` | `name`, `sym_name`, `attributes`, `body` |

### Structural

`region`, `entry_block`, `block`, `block_label`, `block_arg_list`,
`op_result`, `value_use`, `symbol_ref_id`, `successor`, `caret_id`,
`func_arg_list`, `func_return`, `function_type`, `type_list_attr_parens`,
`variadic`, `bare_id`

### Types

`type`, `builtin_type`, `dialect_type`, `type_alias`, `type_alias_def`,
`integer_type`, `float_type`, `index_type`, `none_type`, `complex_type`,
`memref_type`, `tensor_type`, `vector_type`, `tuple_type`, `opaque_type`,
`dialect_namespace`, `dialect_ident`, `opaque_dialect_item`,
`pretty_dialect_item`, `parametric_dialect_item`,
`pretty_dialect_item_body`,
`dimension_separator`, `dimension_size`

### Attributes

`attribute`, `attribute_value`, `attribute_entry`, `dictionary_attribute`,
`builtin_attribute`, `dialect_attribute`, `attribute_alias`,
`attribute_alias_def`, `distinct_attribute`, `strided_layout`,
`affine_map`, `affine_set`

### Literals

`integer_literal`, `float_literal`, `complex_literal`, `bool_literal`,
`string_literal`, `escape_sequence`, `invalid_escape`,
`tensor_literal`, `array_literal`, `unit_literal`,
`uninitialized_literal`, `dense_resource_literal`

### Locations

`trailing_location`, `location`, `unknown_location`, `callsite_location`,
`fused_location`, `external_resources`

### Miscellaneous

`comment`

## Key Design Decisions

### Custom Operations Are Parsed by Structured Fallback

MLIR dialects can define arbitrary custom assembly formats. Enumerating
every upstream dialect operation in the grammar is not feasible — new
dialects appear regularly, and each would require parsing custom syntax.

Instead, the parser uses a broad but structured fallback for custom
operation bodies. The fallback is split into internal helper groups
(`_custom_body_*`) that accept references, typed payloads, braced
groups, dialect-specific markers, delimiter groups, atoms, and
punctuation. GLR handles the ambiguity between these interpretations.

A small number of operation spellings get dedicated branches because
a local token sequence has dialect-specific meaning that a generic
fallback cannot resolve:

- `func.func`, `llvm.func`, `module`, `builtin.module` — provide
  stable fields for names, arguments, attributes, returns, and bodies.
- `affine.for` — the induction variable `loc(...)` must not steal the
  operation-level trailing location.
- `pdl_interp.record_match` — `loc([%root])` is body syntax, not a
  trailing source location.
- Dotted custom operations followed by `loc(...) { ... }` — the first
  `loc(...)` is body syntax; only the final one is the operation location.

### All Declared Conflicts Are Intentional

The 12 conflicts listed in `grammar.js` are load-bearing — removing any
one causes `tree-sitter generate` to fail with an unresolved conflict.
The `array` and `tensor` keyword conflicts were additionally tested
with token precedence substitution, which increased state count and
parser size without improving the AST, so they remain as declared
conflicts.

#### Core MLIR Overlaps (7)

| Conflict | Cause |
| --- | --- |
| `_static_dim_list × _static_dim_list` | Dimensionality (`2x?x3xf32`) needs both single-item and repeated parses before seeing the next `x`. Inherent to MLIR shaped type syntax. |
| `type_alias × dialect_namespace` | `!foo<...>` can be a type alias or a dialect namespace before the following body decides. |
| `dialect_namespace × attribute_alias` | `#foo<...>` has the same prefix ambiguity for attribute aliases and dialect attributes. |
| `pretty_dialect_item × pretty_dialect_item` | A pretty dialect item can be complete at `ns.ident` or continue into a `<...>` body. |
| `_value_use_list × _value_use_and_type` | A value in parentheses can be a list element or the start of a value-with-type form. |
| `_type_list_no_parens × _type_or_func_type` | Function results can be a type list or individual type-or-function-type entries. |
| `_type_list_parens × _multi_dim_affine_expr_parens` | Empty or comma-separated paren forms overlap between type lists and affine expressions. |

#### Custom-Body Fallback Overlaps (5)

| Conflict | Cause |
| --- | --- |
| `custom_op_name × attribute_entry` | A bare identifier at the start of a body element can be the next operation name or the current operation's attribute key. |
| `array_literal × _custom_body_array_keyword` | `array` is both a literal introducer (`array<...>`) and a valid loose body keyword. Token precedence was tested and rejected (increases size without improving AST). |
| `_custom_body_tensor_keyword × tensor_type` | Same pattern as `array` for the `tensor` keyword. Token precedence rejected for the same reason. |
| `_generic_custom_operation_with_location_attr_dict × custom_op_name` | A dotted name followed by `loc(...)` can be a specialized loc+attribute form or a generic operation name. |
| `_custom_body_dict_key × attribute_entry` | A string followed by `=` can be a custom SSA dictionary key or a normal dictionary attribute key. |

### No External Scanner

The parser uses no external scanner — it is a pure `grammar.js` with GLR
conflict resolution. The remaining hard problems are parser-structure
decisions (which branch to prefer at a given point), not lexical-state
decisions (which token to emit for a given character).

An external scanner should be reconsidered only when one of these is true:

- A new lexical feature (e.g. raw strings with custom delimiters) cannot
  be expressed safely in pure grammar.
- Pretty or opaque dialect payloads need lexical state to split reliably
  and the pure-grammar approach causes AST instability.
- A specific, reproducible performance regression is traced to GLR
  branching that a scanner prototype can measurably improve.

**Before adding a scanner**, prototype it and compare: AST hashes (via
`node bench.mjs --verify`), `STATE_COUNT`, parser size, and the slow-tail
report (`node bench.mjs --slow 15 --runs 3`). Document the ABI and
build-chain impact (7 language bindings, 3 OS CI) in the commit that
introduces the scanner.

## Correctness Gates

Three layers must pass before any grammar change is merged:

1. **`tree-sitter test`** — hand-written corpus (158 assertions) and
   highlight queries.
2. **`npm run test:examples`** — parses the 549 checked-in upstream MLIR
   examples in `examples/`. Must remain at 100%.
3. **`node bench.mjs --verify`** — checks that every file in
   `bench/ast-manifest.json` still parses successfully **and** produces
   the same AST structure (hashed, platform-independent). This catches
   silent AST shape changes that pass `test:examples` without errors.

`node bench.mjs --slow 15 --runs 3` is a diagnostic tool for review,
not a merge gate. Use it to check whether a grammar change degrades
the slowest files.

## Adding Grammar for New MLIR Syntax

When adding support for a syntax feature (a new builtin type, a dialect
construct, etc.), follow this checklist:

1. Add a minimal corpus case to `test/corpus/` that isolates the feature.
2. Add at least one upstream example to `examples/` (via
   `scripts/sync-examples.sh`) that exercises the feature in context.
3. Run `tree-sitter generate` and confirm:
   - No new **unresolved** conflicts (the `generate` command exits 0).
   - Declared conflict count does not increase (or the increase is
     justified in the commit message).
4. Run `tree-sitter test`, `npm run test:examples`, and
   `node bench.mjs --verify`. All must pass.
5. If the change touches a node listed in the Public AST Surface above,
   call it out in the commit message and update this document if the
   surface contract changes.
6. If the change introduces a new declared conflict, add an entry to
   the Declared Conflicts table above and annotate it in `grammar.js`.
