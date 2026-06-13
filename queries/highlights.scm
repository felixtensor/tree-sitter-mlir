;; ---------------------------------------------------------------------------
;; MLIR Syntax Highlighting
;; For Neovim (nvim-treesitter), Helix, and other tree-sitter-compatible
;; editors. Uses standard tree-sitter capture names.
;; ---------------------------------------------------------------------------

(comment) @comment

;; ── Operations (Tiered) ─────────────────────────────────────────────────────
;; Builtin/Standard operations
(func_operation name: _ @function.builtin)
(module_operation name: _ @function.builtin)
(func_operation ["private" "public" "attributes"] @keyword)
(function_specifier) @keyword
(module_operation "attributes" @keyword)

;; Dialect operations (e.g., arith.addi)
(custom_op_name) @function.builtin
(generic_operation (string_literal) @function.builtin)
(custom_operation ["array" "sparse" "tensor" "vector"] @keyword)
(custom_operation ["+" "-" "*" "/" "&" "|" "~"] @operator)

;; Symbols (@name)
(symbol_ref_id) @string.special.symbol
(func_operation sym_name: (symbol_ref_id) @function)
(module_operation sym_name: (symbol_ref_id) @function)

;; ── Types & Attributes ──────────────────────────────────────────────────────
;; Individual builtin type nodes — captures nested types inside dim_list
;; (e.g. vector inside memref<256 x 256 x vector<8 x f32>>) which are
;; reached through the hidden _prim_type rule, not through builtin_type.
[(builtin_type)
 (memref_type) (vector_type) (tensor_type) (complex_type) (tuple_type)
 (opaque_type) (integer_type) (float_type) (index_type) (none_type)] @type.builtin
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
(affine_map "affine_map" @keyword)
(affine_set "affine_set" @keyword)
(affine_map ["max" "min" "symbol"] @keyword)
(affine_set ["max" "min" "symbol"] @keyword)
(strided_layout "strided" @keyword)
(strided_layout "offset" @keyword)
(strided_layout ["?" "*"] @punctuation.special)
(distinct_attribute "distinct" @keyword)
(dense_resource_literal "dense_resource" @keyword)
["ceildiv" "floordiv" "mod"] @operator
(pretty_dialect_item_body ["array" "dense" "opaque" "sparse"] @keyword)

;; ── Literals ────────────────────────────────────────────────────────────────
[(integer_literal) (float_literal) (complex_literal)] @number
(bool_literal) @boolean
[(tensor_literal) (array_literal) (unit_literal) (uninitialized_literal)] @constant.builtin
(string_literal) @string

;; Escape sequences inside strings (\n, \t, \", \\, \HH) overlay on @string;
;; malformed escapes are flagged distinctly rather than silently colored.
(escape_sequence) @string.escape
(invalid_escape) @error

;; ── SSA Variables (%name) ───────────────────────────────────────────────────
;; General uses and results (catch-all, overridden by more specific rules below)
(op_result) @variable
(value_use) @variable

;; Formal Parameters override the general variable rule above
(func_arg_list (value_use) @variable.parameter)
(block_arg_list (value_use) @variable.parameter)

;; ── Control Flow ────────────────────────────────────────────────────────────
(caret_id) @tag
(trailing_location "loc" @keyword)
(callsite_location ["callsite" "at"] @keyword)
(fused_location "fused" @keyword)
(location "to" @keyword)
(unknown_location) @constant.builtin
(variadic) @punctuation.special

;; ── Punctuation ─────────────────────────────────────────────────────────────
["(" ")" "{" "}" "[" "]" "<" ">"] @punctuation.bracket
["," ":"] @punctuation.delimiter
["=" "->" "::"] @operator

;; Catch-all for bare keywords in Op bodies (ins, outs, etc.)
(bare_id) @keyword

;; Dense resource handles override the bare_id catch-all above.
(dense_resource_literal (bare_id) @constant.builtin)

;; Dictionary attribute keys override the bare_id catch-all above
(attribute_entry (bare_id) @attribute)
