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
(func_operation ["private" "attributes"] @keyword)

;; Dialect operations (e.g., arith.addi)
(custom_op_name) @function.builtin
(generic_operation (string_literal) @function.builtin)

;; Symbols (@name)
(symbol_ref_id) @string.special.symbol
(func_operation sym_name: (symbol_ref_id) @function)
(module_operation sym_name: (symbol_ref_id) @function)

;; ── Types & Attributes ──────────────────────────────────────────────────────
(builtin_type) @type.builtin
[(type_alias) (type_alias_def) (dialect_type)] @type

[(attribute_alias) (attribute_alias_def) (dialect_attribute) (builtin_attribute) (dictionary_attribute)] @attribute

;; Specific attribute content
(affine_map ["max" "min" "symbol"] @keyword)
(affine_set ["max" "min" "symbol"] @keyword)
(strided_layout "offset" @keyword)

;; ── Literals ────────────────────────────────────────────────────────────────
[(integer_literal) (float_literal) (complex_literal)] @number
(bool_literal) @boolean
[(tensor_literal) (dense_resource_literal) (array_literal) (unit_literal) (uninitialized_literal)] @constant.builtin
(string_literal) @string

;; ── SSA Variables (%name) ───────────────────────────────────────────────────
;; General uses and results (catch-all, overridden by more specific rules below)
(op_result) @variable
(value_use) @variable

;; Formal Parameters override the general variable rule above
(func_arg_list (value_use) @variable.parameter)
(block_arg_list (value_use) @variable.parameter)

;; ── Control Flow ────────────────────────────────────────────────────────────
(caret_id) @label
(trailing_location "loc" @keyword)
(variadic) @punctuation.special

;; ── Punctuation ─────────────────────────────────────────────────────────────
["(" ")" "{" "}" "[" "]" "<" ">"] @punctuation.bracket
["," ":"] @punctuation.delimiter
["=" "->" "::"] @operator

;; Catch-all for bare keywords in Op bodies (ins, outs, etc.)
(bare_id) @keyword

;; Dictionary attribute keys override the bare_id catch-all above
(attribute_entry (bare_id) @attribute)
