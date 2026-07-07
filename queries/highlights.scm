;; ---------------------------------------------------------------------------
;; MLIR Syntax Highlighting
;; For Neovim (nvim-treesitter), Helix, and other tree-sitter-compatible
;; editors. Uses standard tree-sitter capture names.
;; ---------------------------------------------------------------------------

(comment) @comment

;; ── Operations (Tiered) ─────────────────────────────────────────────────────
;; Builtin/Standard operations
(func_operation name: _ @function.builtin)
(func_operation visibility: _ @attribute)
(func_operation specifier: (function_specifier) @keyword)
(func_operation "attributes" @attribute)
(module_operation name: _ @function.builtin)
(module_operation "attributes" @attribute)

;; Dialect operations (e.g., arith.addi)
(custom_op_name) @function.builtin
(custom_operation ["array" "sparse" "tensor" "vector"] @keyword)
(custom_operation ["+" "-" "*" "/" "&" "|" "~"] @operator)
(custom_operation "?" @punctuation.special)
(custom_operation "loc" @keyword)
(custom_operation "module(" @keyword)
(custom_operation ">" @punctuation.bracket)

;; Symbols (@name)
(symbol_ref_id) @string.special.symbol

;; ── Types & Attributes ──────────────────────────────────────────────────────
;; Individual builtin type nodes — captures nested types inside dim_list
;; (e.g. vector inside memref<256 x 256 x vector<8 x f32>>) which are
;; reached through the hidden _prim_type rule, not through builtin_type.
[(builtin_type)
 (memref_type) (vector_type) (tensor_type) (complex_type) (tuple_type)
 (opaque_type) (integer_type) (float_type) (index_type) (none_type)
 (token_type)] @type.builtin
[(type_alias) (type_alias_def) (dialect_type)] @type

;; Dimension sizes inside type dimension lists (256, 8, etc.)
(dimension_size) @number

;; 'x' separator inside dimension lists — render as delimiter rather than
;; inheriting the outer @type.builtin highlight (e.g. tensor<?x?x16xbf16>).
;; @cap binds to the "x" literal (parent-internal anonymous token), not the
;; whole dim_list — placing @cap outside an alternation would capture the
;; parent node instead.
(dim_list "x" @punctuation.delimiter)
(dimension_separator) @punctuation.delimiter
(vector_dim_list "x" @punctuation.delimiter)
(dim_list ["?" "*"] @punctuation.special)
(dialect_dim_list ["?" "*"] @punctuation.special)

[(attribute_alias) (attribute_alias_def) (dialect_attribute) (builtin_attribute) (dictionary_attribute)] @attribute

;; Specific attribute content
(properties ["<{" "}>"] @punctuation.bracket)
;; Builtin introducers that take a <payload> (affine_map, dense, array, ...)
;; are @constructor.builtin: they name a builtin form that constructs a value,
;; and the channel stays distinct from the numeric payloads and the enclosing
;; literal's @constant.builtin. Bare literals with no payload (unit, bools)
;; remain @constant.builtin/@boolean.
(affine_map "affine_map" @constructor.builtin)
(affine_set "affine_set" @constructor.builtin)
(affine_map ["max" "min" "symbol"] @keyword)
(affine_set ["max" "min" "symbol"] @keyword)
(affine_map
  ["dense" "sparse" "compressed" "singleton" "loose_compressed" "n_out_of_m"]
  @keyword)
(affine_set
  ["dense" "sparse" "compressed" "singleton" "loose_compressed" "n_out_of_m"]
  @keyword)
(affine_map ["+" "-" "*" "==" ">=" "<="] @operator)
(affine_set ["+" "-" "*" "==" ">=" "<="] @operator)
(strided_layout "strided" @keyword)
(strided_layout "offset" @keyword)
(strided_layout ["?" "*"] @punctuation.special)
(distinct_attribute "distinct" @keyword)
(dense_resource_literal "dense_resource" @constructor.builtin)
["ceildiv" "floordiv" "mod"] @operator

;; Pretty dialect bodies are dialect-defined payloads. Bare identifiers such as
;; sparse tensor map fields and address-space mnemonics render as keywords.
(pretty_dialect_item_body
  ["array" "dense" "opaque" "sparse" "tensor" "vector"] @keyword)
(pretty_dialect_item_body (bare_id) @keyword)
(pretty_dialect_item_body ["?" "*"] @punctuation.special)

;; ── Literals ────────────────────────────────────────────────────────────────
[(integer_literal) (float_literal) (complex_literal)] @number
(bool_literal) @boolean
[(tensor_literal) (array_literal) (unit_literal) (uninitialized_literal)] @constant.builtin
(tensor_literal ["dense" "sparse"] @constructor.builtin)
(array_literal "array" @constructor.builtin)
(string_literal) @string
(generic_operation (string_literal) @function.builtin)

;; Escape sequences inside strings (\n, \t, \", \\, \HH) overlay on @string;
;; malformed escapes are flagged distinctly rather than silently colored.
(escape_sequence) @string.escape
(invalid_escape) @error

;; ── SSA Variables (%name) ───────────────────────────────────────────────────
;; All SSA values share one channel so a func/block argument and the values
;; derived from it read as the same colour. (value_use) already covers
;; arguments, so no parameter-specific rule is needed.
[(op_result) (value_use)] @variable.special

;; ── Control Flow ────────────────────────────────────────────────────────────
(caret_id) @label
(trailing_location "loc" @keyword)
(callsite_location ["callsite" "at"] @keyword)
(fused_location "fused" @keyword)
(location "to" @keyword)
(unknown_location) @constant.builtin
(variadic) @punctuation.special

;; ── External Resource Blocks ───────────────────────────────────────────────
(external_resources ["{-#" "#-}"] @punctuation.bracket)

;; ── Punctuation ─────────────────────────────────────────────────────────────
["(" ")" "{" "}" "[" "]" "<" ">"] @punctuation.bracket
["," ":"] @punctuation.delimiter
["=" "->" "::"] @operator

;; Catch-all for bare keywords in custom operation bodies (ins, outs, etc.).
;; Keep this scoped to direct custom_operation children so attribute keys and
;; affine dimensions do not inherit keyword coloring from this fallback.
(custom_operation (bare_id) @keyword)

;; Dense resource handle: this bare_id is nested inside dense_resource_literal,
;; not a direct custom_operation child, so the catch-all above never matches it.
(dense_resource_literal (bare_id) @constant.builtin)

;; Dictionary attribute keys: bare_id/string live inside attribute_entry,
;; disjoint from the direct-child catch-all above (so order does not matter).
(attribute_entry (bare_id) @attribute)
(attribute_entry (string_literal) @attribute)
