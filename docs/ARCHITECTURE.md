# Architecture

This document describes the parser's design decisions that a contributor
needs to understand before changing the grammar, queries, or bindings.
It is **not** a changelog or a project status report.

## Public AST Surface

These named nodes and fields are the stable contract consumed by queries,
editor integrations, and language bindings. **Do not rename or remove any
of them without an explicit review.**

When a node appears here, it is expected to keep the same name, parent
relationship, and field structure across grammar changes. Changes to this
surface should be made deliberately, covered by focused corpus examples,
and called out in the grammar or query commit that needs the change.

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
| `func_operation` | `name`, `visibility`, `specifier`, `sym_name`, `arguments`, `return`, `vscale_range`, `comdat`, `attributes`, `body` |
| `function_specifier` | LLVM linkage / visibility / unnamed_addr / calling-convention keyword inside `llvm.func` |
| `vscale_range`, `comdat` | `llvm.func` post-signature clauses: `vscale_range(min, max)` and `comdat(@selector)` |
| `module_operation` | `name`, `sym_name`, `properties`, `attributes`, `body` |

`operation.lhs` labels every `op_result`; commas and `=` are unfielded.
The optional `func_operation.attributes` and `module_operation.attributes`
fields label only the `dictionary_attribute` or `attribute` node; the optional
`"attributes"` keyword is unfielded.

The optional `module_operation.properties` field contains a `properties` node
for either spelling of the custom `prop-dict`: `<{key = value}>` or
`<key = value>`. Its entries are `attribute_entry` children in both cases.
Generic `<{...}>` properties keep their named nodes and fields, with separate
`<`, `{`, `}` and `>` anonymous tokens.

### Structural

`region`, `entry_block`, `block`, `block_label`, `block_arg_list`,
`op_result`, `value_use`, `symbol_ref_id`, `successor`, `caret_id`,
`func_arg_list`, `func_return`, `function_type`, `type_list_attr_parens`,
`variadic`, `bare_id`

`block_arg_list` accepts both `type` and `function_type` children, including
higher-order values such as `%fn: () -> ()`.

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

## MLIR-Aware Parser Foundations

This grammar is designed for MLIR's extensible textual IR, not for a closed
list of dialects. Dialects can register operations, types, attributes, and
custom assembly parsers at runtime; a static tree-sitter parser cannot and
should not reproduce that registry, its verifiers, or its semantic callbacks.
The parser instead exposes a stable syntactic foundation that remains useful
when a dialect is unknown.

The design follows six principles:

1. **Operation-first.** Preserve `operation`, `region`, `block`, result,
   operand, successor, symbol, type/attribute envelope, and trailing-location
   boundaries before attempting to classify dialect-specific body syntax.
2. **Generic-anchored.** Keep quoted generic operations strict and
   dialect-independent. Generic form is MLIR's stable compatibility path and
   must not acquire loose custom-assembly fallbacks.
3. **Dialect-open.** Accept open dialect namespaces and structurally bounded
   payloads without enumerating the dialect ecosystem. A dedicated operation
   branch needs a demonstrated structural or consumer benefit.
4. **Boundary-preserving.** Unknown content may be represented coarsely or
   produce a local `ERROR`; it must not silently consume a following operation,
   block label, region boundary, or operation-level `loc(...)`.
5. **Consumer-driven.** Add public nodes and fields only when they provide a
   stable benefit to queries, editor integrations, or downstream consumers.
   Matching the runtime MLIR parser's semantic detail is not by itself a goal.
6. **Evidence-bounded.** Every new conflict, recursive fallback, dedicated
   dialect branch, or scanner responsibility needs a minimal reproducer and a
   focused test proportional to its maintenance cost.

These principles define a layered compatibility contract:

| Layer | Parser commitment |
| --- | --- |
| Stable MLIR core | Precise CST for corpus-covered forms of generic operations and the shared operation/region/block, type, attribute, symbol, and location structures documented above |
| Structurally unknown dialect syntax | Preserve paired delimiters, high-value sigil references, literals, and recoverable outer boundaries where the static grammar has enough evidence |
| Runtime dialect semantics | No claim to reproduce registered assembly callbacks, verifier rules, traits, interfaces, macro-like expansion, or lowering behavior |

For malformed or incomplete input, success is measured by the smallest useful
error span and recovery of subsequent MLIR structure, not by eliminating every
`ERROR` node. In particular, an `ERROR` inside one custom operation is preferable
to an apparently successful parse that absorbs later sibling operations.

Other extensible-language grammars are references, not templates: a borrowed
method is accepted only when it strengthens an MLIR-specific invariant, test,
query contract, or scanner constraint.

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

#### Where a Custom Body Ends

A custom body has no terminator: it ends only where the next operation's first
token cannot continue it, whether or not the operation before binds results.

| Following syntax begins with | Body ends? |
| --- | --- |
| A line-start binding (`%x =`, `%a, %b =`, `%x:2 =`) | Yes, via the scanner's `_op_result_sigil` |
| A line-start generic operation (`"x.y"(%a) : ...`) | Yes, via the scanner's `_generic_op_quote` |
| A dotted or listed bare name (`memref.store`, `return`) | Yes, via token precedence over `bare_id` |
| A `module` symbol payload (`module @Sub`, `module (@Sub)`) | No, via the scanner's `_custom_body_module_keyword`; see the header distinction below |
| A module header (`module @M { ... }`, also with properties or attributes) | Yes, via the ordinary `module_operation` path |
| A default-dialect bare name that binds nothing (`rewrite` in `pdl.pattern`) | No: a known limit. Whether a bare identifier names an operation is runtime knowledge, and continuation lines such as `ins(...)` look the same |

`constant` uses the default-dialect bare-name fallback rather than the listed
high-precedence names: it is also a modifier in `memref.global` and
`llvm.mlir.global`, where it must continue the body. A result binding still
starts a separate default-dialect `constant` operation.

`module` can also introduce a symbol in a custom body: `module @Sub`,
`module @Sub(...)` and `module (@Sub)` stay in that body. The scanner emits
only the keyword after checking past the symbol; whitespace and comments are
insignificant. After an unparenthesized symbol, `{`, `<` or `attributes` keeps
the ordinary module header, so `module @M { ... }` still starts a separate
operation, even on the same line. Header-shaped custom payloads retain this
conservative reading; an incomplete `module @M` without a header introducer can
stay in the preceding custom body. A pure grammar alternative kept both readings
but changed unrelated operation boundaries and failed incremental fuzzing.

#### What a Brace Encloses in a Custom Body

A `{` reads as a region, an attribute dictionary or a known brace payload
(`{%v : t}`, `{(%v)}`, `{"k" = %v}`) wherever one of them can continue.
Otherwise it opens a group whose balanced contents stay flat in the
`custom_operation`. The group starts on a token none of the others accepts
after `{`, or on a string or value followed by one.

Comma-separated value lists such as `{%a, %b}` stay flat in the custom body;
`{%a, %b = test.op}` remains a region with result bindings. A local conflict
keeps both readings until `}` or `=` distinguishes them, including in nested
groups; no dynamic precedence chooses between complete parses.

Bare-key assignment braces such as `{src_etype=f16, dst_etype=f8}` stay flat
when a value lexes as `bare_id` rather than a core attribute. Ordinary values
before the first enum retain `attribute_value` nodes. Dictionaries and generic
attributes keep their normal rules. Reserved enum words such as `array` and
`tensor`, unit-key prefixes and quoted enum keys are outside this fallback.

Module symbol arguments inside braces are supported once the brace has entered
the fallback payload path, as in `{ @A module @Sub }`. A brace led by `module`
still takes the region path: `{ module @Sub }` reports a local error for the
incomplete module header.

After a type inside `(...)`, a name-only brace is an argument attribute
dictionary, not a region (`transform.named_sequence ... {transform.readonly}`).
A body-level name-only brace keeps the region reading: without the operation's
assembly format it is indistinguishable from `{ scf.yield }`.

For a direct-body fallback, the scanner checks for a line-start operation/block
boundary or EOF before the matching close. If found, it emits the opening brace
and malformed prefix as one token, leaving boundary-leading whitespace intact.
The required `}` then triggers a local `ERROR` or missing close so following
structure can recover; the error need not belong to the preceding operation.
Otherwise the group stays in the grammar. Nested delimiters, strings and
comments protect their contents; names followed by `=` remain assignment keys.
Bare-key assignment leads use the same recovery check.

Recovery is bounded: direct operation-shaped payload continuations can be split,
and an enclosing `}` seen first can still be mistaken for the payload close.
Alias definitions, unlisted bare operations, incomplete specialized headers and
malformed nested groups are not covered by this recovery path.

The scanner also consumes fully balanced groups whose lead is `#`, `!`, or a
`^` that is not a block label; their contents remain opaque. Ordinary regions,
dictionaries and known brace payloads keep their existing grammar paths.

This is a recovery rule, not a promise that every balanced delimiter sequence
is valid MLIR. The operation grammar reserves `<{...}>` for dictionary
properties, and `^id:` is a block label only in a region. A combination such as
`test.op <{^bb0:}>` therefore remains an error; the opaque scanner covers only
complete groups that do not conflict with those MLIR structures.

Anywhere inside `<...>`, also nested in `(...)`, `[...]` or `{...}`, a `{` is
never a region under the unknown-dialect recovery policy, and a bare key
followed by anything but `=` or `,` also opens the group
(`struct<{a: i32}>`, `<{a: {b: i32}}>`).

Like a `(...)` or `[...]` group, the brace group is hidden and adds no node.
Queries that act on `region`, such as `folds.scm`, `indents.scm` and
`locals.scm`, therefore neither fold, indent nor scope it, even when it spans
lines.

#### Properties, Attribute Dictionaries and Regions

| Spelling | Class |
| --- | --- |
| `<{...}>` (generic), `<key = value>` / `<{...}>` (custom `prop-dict`) | Properties: declared by the operation, stored in properties, verified by its definition |
| `{...}` (generic, after regions; `attr-dict` / `attributes {...}` in custom form) | Attribute dictionary; legacy/compatibility parsing may include inherent attributes |
| `({...})` (generic), `{...}` where a custom format places a region | Region |

Properties delimiters are separate `<`, `{`, `}` and `>` tokens, so spaces,
newlines and comments may separate them. Generic operations still require
the dictionary braces; the custom module prop-dict additionally accepts the
unbraced spelling.

A bare `{...}` is not properties syntax. In custom form it can be an attribute
dictionary or a region; only the operation's assembly format decides. Generic
syntax is unambiguous. The fallback resolves the decidable argument-attribute
position after a type inside `(...)` and keeps the body-level ambiguity as a
known limit (`memref.dealloc %m {test.flag}`,
`test.op attributes {test.flag}`). The grammar does not enforce the LangRef
key-prefix classification: unprefixed keys and nested dictionaries are
accepted. Consumers needing exact classification should use an MLIR-aware tool.

Known limits: a payload that fails only later still fails there
(`{[0, 1] = %v}` reads as a dictionary), and outside `<...>` `{a: i32}` is
still a region. Inside `<...>` a first bare key followed by `,` reads as a
dictionary entry, so `<{a, b: i32}>` fails at `b:`.
`<{%a, %b = test.inner}>` also reports a local error: the angle payload stays
region-free, so it cannot contain structured operation result bindings.
These cases retain following operation and function boundaries.
The opaque-group token requires a matching `}`. At line start,
the scanner also marks `#name =` and `!name =` as alias-definition boundaries
so a preceding custom body cannot absorb a following top-level alias.

### All Declared Conflicts Are Intentional

The 13 conflicts in `grammar.js` are load-bearing: `generate` fails without
any one. The `array`/`tensor` token-precedence alternatives were rejected for
size without AST benefit. Dialect bodies use `token.immediate("<")`, so
`!ns<...>` / `#ns<...>` attach the body to the name; whitespace or comments
leave a separate custom-body group.

#### Core MLIR Overlaps (2)

| Conflict | Cause |
| --- | --- |
| `_value_use_list × _value_use_and_type` | A value in parentheses can be a list element or the start of a value-with-type form. |
| `_type_list_no_parens × _type_or_func_type` | Function results can be a type list or individual type-or-function-type entries. |

#### Custom-Body Fallback Overlaps (9)

| Conflict | Cause |
| --- | --- |
| `custom_op_name × attribute_entry` | A bare identifier at the start of a body element can be the next operation name or the current operation's attribute key. |
| `custom_op_name × _custom_body_brace_group × attribute_entry` | Before `=`, a bare key may start an operation, dictionary or enum payload; the value decides. |
| `_custom_body_brace_group × attribute_entry` | An attribute-valued prefix may lead to a dictionary or a later bare enum; the comma cannot decide. |
| `array_literal × _custom_body_array_keyword` | `array` is both a literal introducer and a loose body keyword. |
| `_custom_body_tensor_keyword × tensor_type` | Same overlap for `tensor`. |
| `_generic_custom_operation_with_location_attr_dict × custom_op_name` | A dotted name followed by `loc(...)` can be a specialized loc+attribute form or a generic operation name. |
| `_custom_body_dict_key × attribute_entry` | A string followed by `=` can be a custom SSA dictionary key or a normal dictionary attribute key. |
| `op_result × _custom_body_brace_group` | After `{%a,`, `}` completes a flat value-list payload while `=` completes region result bindings. This is local ambiguity; static precedence would discard one valid form. |
| `_custom_body_element_base × _custom_body_typed_arg_attr` | A name-only brace after a type inside `(...)` can be an argument attribute dictionary or a single-operation region; the corpora contain only the former. |

Dynamic precedence `-1` on `_generic_custom_operation` keeps
`linalg.generic {indexing_maps = ...}` a dictionary and enum payloads flat.
A dotted key with `=` never reaches that conflict and is read as a dictionary
entry. Without `=`, it is a dictionary only in the decidable argument-attribute
position; elsewhere it keeps the region reading, like `{ scf.yield }`.

#### Pretty-Dialect Body Overlaps (2)

| Conflict | Cause |
| --- | --- |
| `_pretty_dialect_item_contents × tensor_type` | `tensor` is both a bare payload keyword and a builtin type introducer, including inside a nested tuple. |
| `_pretty_dialect_item_contents × opaque_type` | `opaque` has the same keyword/type overlap. |

These keywords sit outside the left-associative pretty-body fallback:
committing either way loses valid nested builtin nodes or balanced unknown
payloads. The conflicts keep both readings until the payload completes;
dynamic precedence `-1` on nested `pretty_dialect_item_body` then prefers the
structured reading. Corpus tests pin both readings and following boundaries.

### External Scanner

The scanner resolves lexical ambiguities: `^suffix` as successor vs block
label, `x` as dimension separator vs identifier, and a line-start result binding
or generic operation as the next operation rather than custom-body syntax. It
also distinguishes a custom-body `module` symbol argument from a module header.
It emits:

| Token | Role |
| --- | --- |
| `_caret_id` / `_block_label_id` | successor/reference vs block label |
| `_custom_body_dimension_separator` | `x` in `16x16` / `16x?` |
| `_op_result_sigil` / `_generic_op_quote` | line-start operation boundaries; only the sigil is consumed |
| `_custom_body_opaque_brace_group` | balanced `#`/`!`/non-label `^` group, hidden |
| `_custom_body_unclosed_brace_prefix` | local recovery of an unsafe fallback opener |
| `_recovery_dotted_op_name` | preserve a dotted name during recovery |
| `_attribute_alias_sigil` / `_type_alias_sigil` | line-start `#name =` / `!name =`; only the sigil is consumed |
| `_error_sentinel` | recovery-lexer validity marker, never emitted |
| `_custom_body_module_keyword` | only `module`, after lookahead rules out a module header; ordinary grammar parses its symbol and parentheses |
| `_pretty_dialect_fallback` | single-character punctuation fallback inside `pretty_dialect_item_body` outside recovery; skips whitespace so named nodes keep tight ranges and yields to grammar tokens and `.` |

The boundary tokens require a line start: a continuation line is cut only if
it has the full binding or generic shape. Known limits: an operation sharing a
line with the previous body is absorbed, and an unknown-dialect continuation
line with the generic shape can be cut. Caret and dimension tokens appear as
`caret_id` / `dimension_separator`; boundary tokens consume only the sigil, so
the ordinary `value_use` / `string_literal` path supplies the rest (pinned by a
`:cst` case). The scanner has no persistent state.

The boundary decision is lexical because a dynamic-precedence/conflict version
passed full parses but failed an incremental re-parse in fuzzing. Block-argument
lookahead skips strings and treats `->` as an arrow, not an angle close.
The pretty-body fallback is also lexical because an internal
`token(prec(-1, /[^<>\s]/))` rule produced the same corpus CST but drove
fuzzing into a pathological incremental parse.

Do not add scanner responsibilities unless pure grammar cannot express the
syntax safely or a measured parser-stability problem requires lexical state.

## Correctness Gates

The standard tree-sitter gates must pass before any grammar change is
merged:

1. **`tree-sitter test`** — hand-written corpus and highlight queries.
2. **`npm run test:examples`** — parses the checked-in upstream MLIR examples
   in `examples/`. All checked-in examples must pass; exact counts are not a
   long-lived architecture invariant.
3. **Generated-file check in CI** — reruns `tree-sitter generate` and
   fails if committed parser artifacts are stale.
4. **Query compile check in CI** — compiles every shipped query against
   an example file to catch node-name drift outside highlights.
5. **Parser fuzzing** — `npm run fuzz` rebuilds the parser, directly replays
   known incremental-parse regressions with their fixed seeds, then fuzzes the
   complete corpus with a fresh seed. The same entry point runs locally and in
   CI; grammar, configuration, scanner, generated-parser, corpus, and fuzz-runner
   changes trigger the workflow.

## Adding Grammar for New MLIR Syntax

When adding support for a syntax feature (a new builtin type, a dialect
construct, etc.), follow this checklist:

1. Add a minimal corpus case to `test/corpus/` that isolates the feature.
2. Preserve real-input evidence when it exists. If an upstream example exposed
   the problem, retain it through the normal independent
   `scripts/sync-examples.sh` snapshot; issue- or downstream-driven changes do
   not need a manufactured upstream example.
3. Run `tree-sitter generate` and confirm:
   - No new **unresolved** conflicts (the `generate` command exits 0).
   - Declared conflict count does not increase (or the increase is
     justified in the commit message).
4. Run `tree-sitter test` and `npm run test:examples`. All must pass.
5. If the change touches a node listed in the Public AST Surface above,
   call it out in the commit message and update this document if the
   surface contract changes.
6. If the change introduces a new declared conflict, add an entry to
   the Declared Conflicts table above and annotate it in `grammar.js`.
7. For custom assembly or recovery changes, include a sibling operation,
   block label, region close, or trailing location after the affected syntax
   and assert that the boundary remains intact.
8. For a dedicated dialect branch, document what important MLIR structure or
   real consumer the structured fallback cannot preserve. Dialect popularity
   or nominal coverage alone is not sufficient.
9. For scanner changes, include direct-hit and false-positive corpus cases;
   after the fuzz workflow is available, run it as the scanner stability gate.
