;; ---------------------------------------------------------------------------
;; MLIR Syntax Highlighting
;; For Neovim (nvim-treesitter), Helix, and other tree-sitter-compatible
;; editors. Uses standard tree-sitter capture names.
;; ---------------------------------------------------------------------------

;; ── Comments ────────────────────────────────────────────────────────────────
(comment) @comment

;; ── Operations ──────────────────────────────────────────────────────────────
;; In MLIR every operation is the primary "callable" unit; use @function.builtin
;; for all op names (structural Tier-1 keywords and dialect Tier-2 ops alike).

;; Tier-1: func.func / llvm.func / module / builtin.module
(func_operation   name: _ @function.builtin)
(module_operation name: _ @function.builtin)

;; Optional qualifier keywords within function definitions
(func_operation "private"    @keyword)
(func_operation "attributes" @keyword)

;; Function / module symbol names
;; (these rules are more specific than the catch-all (symbol_ref_id) below)
(func_operation   sym_name: (symbol_ref_id) @function)
(module_operation sym_name: (symbol_ref_id) @function)

;; All other @symbol references — call targets, globals, attribute aliases, …
(symbol_ref_id) @string.special.symbol

;; Tier-2: dialect ops — arith.addi, linalg.fill, cf.br, return, call, …
(custom_op_name) @function.builtin

;; Generic (tablegen-free) form: "some.op"(…) : (…) -> …
(generic_operation (string_literal) @function.builtin)

;; ── Types ────────────────────────────────────────────────────────────────────
(builtin_type) @type.builtin

[
  (type_alias)
  (type_alias_def)
  (dialect_type)
] @type

;; ── Attributes ───────────────────────────────────────────────────────────────
;; Attribute aliases: #alias = value (definition) / #alias (reference)
[
  (attribute_alias_def)
  (attribute_alias)
] @attribute

;; Dialect attributes: #dialect.name<…> / #dialect<"…">
(dialect_attribute) @attribute

;; Builtin attributes: affine_map<…>, affine_set<…>, strided<…>
;; The keyword tokens (affine_map / affine_set / strided) are part of this
;; node's span and are colored @attribute unless overridden by a child capture.
(builtin_attribute) @attribute

;; Affine arithmetic operators / keywords inside affine_map / affine_set.
;; More specific than (builtin_attribute) @attribute, so they override it.
(affine_map "ceildiv"  @keyword)
(affine_map "floordiv" @keyword)
(affine_map "mod"      @keyword)
(affine_map "max"      @keyword)
(affine_map "min"      @keyword)
(affine_map "symbol"   @keyword)
(affine_set "ceildiv"  @keyword)
(affine_set "floordiv" @keyword)
(affine_set "mod"      @keyword)
(affine_set "max"      @keyword)
(affine_set "min"      @keyword)
(affine_set "symbol"   @keyword)

;; "offset" keyword inside strided layout
(strided_layout "offset" @keyword)

;; Dictionary attributes: { key = val, … }
(dictionary_attribute) @attribute

;; Dictionary attribute keys (bare-id form, e.g. "dilations", "strides").
;; More specific than (bare_id) @keyword below, so they take precedence
;; for keys inside a dictionary.
(dictionary_attribute (bare_id) @attribute)

;; ── Literals ─────────────────────────────────────────────────────────────────
[
  (integer_literal)
  (float_literal)
  (complex_literal)
] @number

(bool_literal) @boolean

;; Dense / sparse tensors, arrays, unit, uninitialized
[
  (tensor_literal)
  (array_literal)
  (unit_literal)
  (uninitialized_literal)
] @constant.builtin

;; General string literals — more-specific rules above override when needed
(string_literal) @string

;; ── SSA Variables ─────────────────────────────────────────────────────────────
;; Function argument definitions within the argument list
(func_arg_list (value_use) @variable.parameter)

;; Block argument definitions: ^bb0(%arg : type):
(block_arg_list (value_use) @variable.parameter)

;; Operation result definitions (LHS of assignment): %result = …
(op_result) @variable

;; General SSA value uses (operands); overridden by the arg-list rules above
(value_use) @variable

;; ── Block Labels & Successor References ──────────────────────────────────────
;; Basic-block labels (^bb0, ^entry) use @label — they are GOTO-style labels
;; (like `label:` in C), not XML/HTML tags. nvim-treesitter defines @label as
;; "GOTO and other labels (e.g. `label:` in C), including heredoc labels".
(caret_id) @label

;; ── Miscellaneous Keywords ────────────────────────────────────────────────────
;; Catch-all for dialect-specific bare keyword tokens in custom op bodies:
;; to, from, step, ins, outs, by, dimensions, iterator_types, etc.
;; (dictionary_attribute (bare_id) @attribute) above is more specific and
;; takes precedence for attribute dictionary keys.
(bare_id) @keyword

;; Trailing source location: … loc("file.mlir":1:0)
(trailing_location "loc" @keyword)

;; Variadic placeholder: func @foo(i32, ...)
(variadic) @punctuation.special

;; ── Punctuation ───────────────────────────────────────────────────────────────
[
  "("
  ")"
  "{"
  "}"
  "["
  "]"
  "<"
  ">"
] @punctuation.bracket

[
  ","
  ":"
] @punctuation.delimiter

;; Operators
[
  "="
  "->"
  "::"
] @operator
