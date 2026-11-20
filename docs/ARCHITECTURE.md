# Architecture

Design decisions, public CST contracts, and contributor gates for `tree-sitter-mlir`.
This document is a reference contract, not a changelog or status report.

## Public AST Surface

These named nodes and fields form the contract consumed by queries, editors, and
bindings. **Do not rename or remove them without explicit review.** Helper rules
prefixed with `_` are implementation detail and excluded from this surface.

### Top-Level and Operations

| Node | Key fields / children |
| --- | --- |
| `toplevel` | `operation`, `attribute_alias_def`, `type_alias_def`, `external_resources` |
| `operation` | `lhs`, `rhs`, `location` |
| `custom_operation` | `name`; for `affine.for`, also `induction_location` |
| `custom_op_name` | bare identifier or dotted dialect operation name |
| `generic_operation` | quoted generic MLIR form (`"dialect.op"`) with optional `properties` |
| `func_operation` | `name`, `visibility`, `specifier`, `sym_name`, `arguments`, `return`, `vscale_range`, `comdat`, `attributes`, `body` |
| `function_specifier` | LLVM linkage / visibility / `unnamed_addr` / calling-convention keyword in `llvm.func` |
| `vscale_range`, `comdat` | `llvm.func` post-signature clauses: `vscale_range(min, max)` and `comdat(@selector)` |
| `module_operation` | `name`, `sym_name`, `properties`, `attributes`, `body` |

Field contracts:

- `operation.lhs` labels each `op_result`; `,` and `=` are unfielded.
- `func_operation.attributes` and `module_operation.attributes` label only the
  `dictionary_attribute` or `attribute` node; the optional `"attributes"` keyword
  is unfielded.
- `module_operation.properties` wraps a `properties` node for both `<{...}>` and
  unbraced `<key = value>` custom prop-dict spellings, with `attribute_entry`
  children and separate `<`, `{`, `}`, `>` anonymous tokens.

### Structural

`region`, `entry_block`, `block`, `block_label`, `block_arg_list`,
`op_result`, `value_use`, `symbol_ref_id`, `successor`, `caret_id`,
`func_arg_list`, `func_return`, `function_type`, `type_list_attr_parens`,
`variadic`, `bare_id`, `custom_body_arrow`, `custom_body_dim_list`

`block_arg_list` and `tuple_dim` accept both `type` and `function_type`
(e.g. `%fn: () -> ()`).

### Types

`type`, `builtin_type`, `dialect_type`, `type_alias`, `type_alias_def`,
`integer_type`, `float_type`, `index_type`, `none_type`, `token_type`,
`complex_type`, `memref_type`, `tensor_type`, `tensor_encoding`,
`vector_type`, `tuple_type`, `tuple_dim`, `opaque_type`,
`dim_list`, `vector_dim_list`, `dialect_dim_list`, `dimension_separator`, `dimension_size`,
`dialect_namespace`, `dialect_ident`, `opaque_dialect_item`,
`pretty_dialect_item`, `parametric_dialect_item`, `pretty_dialect_item_body`

### Attributes

`attribute`, `attribute_value`, `attribute_entry`, `dictionary_attribute`,
`array_attribute`, `properties`, `builtin_attribute`, `dialect_attribute`,
`attribute_alias`, `attribute_alias_def`, `distinct_attribute`,
`strided_layout`, `affine_map`, `affine_map_inline`, `affine_set`

Key-value `attribute_entry` nodes expose `key` (`bare_id` or `string_literal`)
and optional `value` (`attribute_value`); array-valued entries (e.g.
`ops{["affine.for"]}`) carry an unfielded `array_attribute` child.

### Literals, Locations, and Miscellaneous

- **Literals:** `integer_literal`, `float_literal`, `complex_literal`,
  `bool_literal`, `string_literal`, `escape_sequence`, `invalid_escape`,
  `tensor_literal`, `array_literal`, `nested_idx_list`, `unit_literal`,
  `uninitialized_literal`, `dense_resource_literal`
- **Locations / Resources:** `trailing_location`, `location`, `unknown_location`,
  `callsite_location`, `fused_location`, `external_resources`
- **Misc:** `comment`

## MLIR-Aware Parser Foundations

MLIR dialects register custom assembly parsers and verifiers at runtime; a
static tree-sitter grammar cannot and should not replicate that registry.
Instead, this grammar provides a stable syntactic foundation across unknown
dialects, guided by six principles:

1. **Operation-first.** Preserve `operation`, `region`, `block`, result,
   operand, successor, symbol, type/attribute envelope, and trailing-location
   boundaries before classifying dialect-specific body syntax.
2. **Generic-anchored.** Keep quoted generic operations strict and
   dialect-independent; never attach loose custom-assembly fallbacks to them.
3. **Dialect-open.** Accept open dialect namespaces and bounded payloads without
   enumerating dialects. Dedicated branches require proven structural or
   consumer value.
4. **Boundary-preserving.** Unknown or malformed content may degrade coarsely or
   emit a local `ERROR`, but must not silently swallow a following operation,
   block label, region close, or trailing `loc(...)`.
5. **Consumer-driven.** Add public nodes and fields only for concrete query,
   editor, or binding needs—not to mirror runtime MLIR parser internals.
6. **Evidence-bounded.** Every new conflict, dedicated branch, or scanner
   responsibility needs a minimal reproducer and focused tests proportional to
   its maintenance cost.

| Layer | Commitment |
| --- | --- |
| Stable MLIR core | Precise CST for corpus-covered generic ops and the shared operation/region/block, type, attribute, symbol, and location structures above |
| Unknown dialect syntax | Preserve balanced delimiters, sigil references, literals, and outer boundaries where static syntax suffices |
| Runtime dialect semantics | No claim to reproduce registered assembly callbacks, verifiers, traits, or lowering semantics |

For malformed input, success means minimizing the error span and recovering
subsequent MLIR structure—a local `ERROR` is preferable to a clean parse that
absorbs sibling operations.

## Key Design Decisions

### Custom Operations Use a Structured Fallback

Rather than enumerating upstream dialects, custom operation bodies parse through
internal `_custom_body_*` fallback rules covering sigil references, typed
payloads, braced/delimited groups, dialect markers, atoms, and punctuation.

Only a few operation spellings keep dedicated branches where a local token
sequence would otherwise break outer boundaries or public fields:

- `func.func`, `llvm.func`, `module`, `builtin.module` — stable fields for
  names, signatures, properties, attributes, and bodies.
- `affine.for` — keeps the induction-variable `loc(...)` from stealing the
  operation's trailing location.
- `pdl_interp.record_match` — treats `loc([%root])` as body syntax, not a
  trailing location.
- Dotted custom ops with `loc(...) { ... }` — keeps the inner `loc(...)` inside
  the body so a final trailing `loc(...)` still attaches to the operation.

#### Where a Custom Body Ends

Custom bodies have no explicit terminator; `prec.right` extends the body until a
token cannot continue it:

| Following syntax | Body ends? | Mechanism |
| --- | --- | --- |
| Line-start result binding (`%x =`, `%a, %b =`, `%x:2 =`) | Yes | Scanner `_op_result_sigil` |
| Line-start generic op (`"x.y"(%a) : ...`) | Yes | Scanner `_generic_op_quote` |
| Line-start alias def (`#a = ...`, `!t = ...`) | Yes | Scanner `_attribute_alias_sigil` / `_type_alias_sigil` |
| Dotted or listed bare op name (`memref.store`, `return`) | Yes | Token precedence over `bare_id` |
| `module` header (`module @M { ... }`, with optional properties/attrs) | Yes | Ordinary `module_operation` rule |
| `module` symbol arg (`module @Sub`, `module (@Sub)`) | No | Scanner `_custom_body_module_keyword` |
| Unbound default-dialect bare name (`rewrite` in `pdl.pattern`) | No (known limit) | Indistinguishable from continuation keywords (`ins(...)`) without runtime dialect state |

Additional boundary notes:

- `constant` stays on the default-dialect `bare_id` fallback because it is also
  a modifier in `memref.global` and `llvm.mlir.global`; result-bound `constant`
  ops still start their own operation.
- For `module`, lookahead checks past the symbol (ignoring whitespace/comments):
  a following `{`, `<`, or `attributes` preserves the `module_operation` header
  even on the same line, while other continuations emit only `"module"` so the
  grammar parses the symbol/parens normally.

#### Braces, Properties, and Attribute Dictionaries

| Spelling | Classification |
| --- | --- |
| `<{...}>` (generic), `<key = value>` / `<{...}>` (custom `prop-dict`) | `properties` (separate `<`, `{`, `}`, `>` tokens; whitespace/comments allowed) |
| `{...}` (generic after regions; `attr-dict` / `attributes {...}` in custom) | `dictionary_attribute` |
| `({...})` (generic), `{...}` in custom region slots | `region` |

In custom bodies, a `{...}` is resolved in order:

1. **Structured forms first:** `region`, `dictionary_attribute` (including
   `{dotted.key = ...}` via static `prec(1)`), or known brace payloads
   (`{%v : t}`, `{(%v)}`, `{"k" = %v}`).
2. **Typed argument attributes:** after a type inside `(...)`, a name-only brace
   (`%arg0: !transform.any_op {transform.readonly}`) prefers
   `dictionary_attribute` dynamically (`4,706` attrs vs `0` real regions in
   audited corpora).
3. **Flat custom-body brace groups (hidden, no `region` node):**
   - Non-region/non-dict leads (e.g. `{"a": %x}`, `{@a -> @b}`), comma-separated
     value lists (`{%a, %b}` vs region `{%a, %b = op}`), and bare-enum
     assignments (`{src_etype=f16, dst_etype=f8}`, keeping `attribute_value`
     nodes before the first bare enum).
   - Balanced groups starting with `#`, `!`, or non-label `^` are consumed
     opaquely by `_custom_body_opaque_brace_group`.
   - Anywhere inside `<...>` (even nested in `(...)`/`[...]`/`{...}`), `{...}`
     is never a `region`; bare keys followed by non-`=`/`,` (e.g.
     `struct<{a: i32}>`) stay flat.
   - Because fallback brace groups are hidden, `region`-based queries
     (`folds.scm`, `indents.scm`, `locals.scm`) do not apply to them.
4. **Localized unclosed-brace recovery:** for direct-body fallback leads
   (including bare-key assignments), if the scanner hits a line-start
   operation/block boundary or EOF before `}`, it emits
   `_custom_body_unclosed_brace_prefix` (excluding boundary-leading whitespace)
   so the missing `}` triggers a local `ERROR` and sibling syntax recovers.
   Nested delimiters, strings, comments, and `=` assignment keys remain
   protected.

**Known limits** (consumers needing exact ODS-level classification should layer
an MLIR-aware tool over tree-sitter):

- Body-level unit-key braces (`memref.dealloc %m {test.flag}`, `test.op
  attributes {test.flag}`) keep the `region` reading—only the op's assembly
  format distinguishes them from `{ scf.yield }`.
- Same-line sibling operations after a custom body are absorbed; an
  unknown-dialect continuation line matching the full generic-op shape can be
  split.
- Unclosed-brace recovery can split direct operation-shaped payload lines, can
  mistake an enclosing `}` for the payload close, and does not cover alias
  definitions, unlisted bare ops, incomplete specialized headers, malformed
  nested groups, or `{ module @Sub }` (which takes the region path and reports a
  local error).
- Payloads that diverge only past their prefix fail locally (`{[0, 1] = %v}`
  reads as a dictionary; outside `<...>`, `{a: i32}` is a region; inside
  `<...>`, `<{a, b: i32}>` fails at `b:` and `<{%a, %b = op}>` stays
  region-free). `test.op <{^bb0:}>` stays an error.
- `attribute_value` permissively accepts unprefixed inline affine maps
  (`affine_map_inline`, e.g. `{map = (d0) -> (d0 : compressed)}`) and sparse
  level keywords for robustness and uniform highlighting (without dedicated
  dimension/level subnodes; legal sparse encodings use
  `#sparse_tensor.encoding<{...}>`).
- Bare-enum braces exclude reserved keywords (`array`, `tensor`), unit-key
  prefixes, and quoted enum keys.

### Declared Conflicts (13 Total, All Load-Bearing)

Removing any declared conflict fails `tree-sitter generate`. Dialect bodies
attach via `token.immediate("<")`, so whitespace/comments leave a following
`<...>` separate and avoid alias-vs-dialect conflicts.

| Group | Conflict | Cause |
| --- | --- | --- |
| Core (2) | `_value_use_list × _value_use_and_type` | Value in parens: list element vs `value : type` |
| | `_type_list_no_parens × _type_or_func_type` | Function results: type list vs single type/function-type |
| Custom body (9) | `custom_op_name × attribute_entry` | Bare id: next op name vs attribute key |
| | `custom_op_name × _custom_body_brace_group × attribute_entry` | Bare key before `=`: op, dict, or enum payload |
| | `_custom_body_brace_group × attribute_entry` | Ordinary attr prefix before a later bare enum |
| | `array_literal × _custom_body_array_keyword` | `array` as literal introducer vs body keyword |
| | `_custom_body_tensor_keyword × tensor_type` | `tensor` as type introducer vs body keyword |
| | `_generic_custom_operation_with_location_attr_dict × custom_op_name` | Dotted op followed by `loc(...) {dict}` |
| | `_custom_body_dict_key × attribute_entry` | Quoted key before `=`: SSA dict vs normal attr dict |
| | `op_result × _custom_body_brace_group` | After `{%a,`: `}` closes value list while `=` starts region binding |
| | `_custom_body_element_base × _custom_body_typed_arg_attr` | Name-only brace after a type in `(...)`: arg attr dict (dynamic +1) vs region |
| Pretty dialect (2) | `_pretty_dialect_item_contents × tensor_type` | `tensor` as bare keyword vs builtin type (incl. inside nested `tuple`) |
| | `_pretty_dialect_item_contents × opaque_type` | `opaque` as bare keyword vs builtin type |

Dynamic precedences: `-1` on `_generic_custom_operation` keeps dicts/enum
payloads ahead of phantom region ops; `-1` on nested `pretty_dialect_item_body`
prefers structured builtin types over balanced fallback bodies without
discarding unknown payloads.

### External Scanner

[src/scanner.c](../src/scanner.c) is **stateless** and handles only lexical
boundaries that pure grammar rules either cannot express or break under
incremental fuzzing:

| Token | Role |
| --- | --- |
| `_caret_id` / `_block_label_id` | Successor/reference vs block label (lookahead skips strings and `->`) |
| `_custom_body_dimension_separator` | `x` in `16x16` / `16x?` |
| `_op_result_sigil` / `_generic_op_quote` | Line-start op boundaries; consumes only `%` / `"` so normal grammar builds the full node |
| `_attribute_alias_sigil` / `_type_alias_sigil` | Line-start `#name =` / `!name =`; consumes only `#` / `!` |
| `_custom_body_opaque_brace_group` | Balanced `#` / `!` / non-label `^` brace group (hidden) |
| `_custom_body_unclosed_brace_prefix` | Localizes unclosed fallback brace payloads before a line-start boundary or EOF |
| `_recovery_dotted_op_name` | Preserves dotted op names in error-recovery lex states |
| `_error_sentinel` | Never emitted; signals recovery lex states cleanly |
| `_custom_body_module_keyword` | Emits only `module` after ruling out a module header |
| `_pretty_dialect_fallback` | Non-recovery single-char punctuation fallback inside `pretty_dialect_item_body`; skips whitespace for tight node ranges and yields to grammar tokens and `.` (a regex fallback caused incremental fuzz hangs) |

Do not add scanner tokens or state unless pure grammar cannot express the syntax
safely or fuzzing proves an incremental-parse failure.

## Correctness Gates

All gates must pass before merge:

1. **`npm run test`** — hand-written corpus (`test/corpus/`) and highlight
   assertions (`test/highlight/`).
2. **`npm run test:examples`** — parses all checked-in upstream MLIR examples in
   `examples/` with zero errors (parse smoke gate, not an exact AST baseline).
3. **Generated-artifact check (CI)** — reruns `tree-sitter generate` and fails
   on stale `src/` artifacts.
4. **Query validation (CI)** — compiles all six `queries/*.scm`, verifies
   `tree-sitter tags` output, enforces the highlight capture allowlist via
   `tree-sitter highlight --check`, and smoke-tests `folds.scm`/`indents.scm`.
5. **Bindings & packaging (CI)** — runs Rust/Python/Go/Node/Wasm tests and
   package dry-runs.
6. **Parser fuzzing (`npm run fuzz`)** — rebuilds the parser, replays fixed
   incremental-regression seeds, and fuzzes the full corpus with a fresh seed.

## Checklist for Grammar Changes

1. Add a minimal corpus case in `test/corpus/` (plus a following sibling
   operation, block label, region close, or trailing `loc(...)` for
   custom-assembly or recovery changes).
2. Keep upstream syncs in separate `scripts/sync-examples.sh` commits; do not
   manufacture upstream examples for issue/downstream fixes.
3. Run `tree-sitter generate` and verify zero unresolved conflicts; justify any
   new declared conflict in `grammar.js` and the table above.
4. Run `npm run test:all` (and `npm run fuzz` for scanner or incremental-risk
   changes).
5. Update this document and `CHANGELOG.md` (and affected `queries/*.scm`) if
   the Public AST Surface changes.
6. Justify any new dedicated dialect branch with a concrete structural or
   consumer gap that the fallback cannot preserve.
7. Include both direct-hit and false-positive corpus tests for any scanner
   change.
