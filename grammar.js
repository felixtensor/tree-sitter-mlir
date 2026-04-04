'use strict';

module.exports = grammar({
  name: 'mlir',
  extras: $ => [/\s/, $.comment],
  conflicts: $ => [
    [$._static_dim_list, $._static_dim_list],
    [$.dictionary_attribute, $.region],
    [$.type_alias, $.dialect_namespace],
    [$.dialect_namespace, $.attribute_alias],
    [$.pretty_dialect_item],
    [$._value_use_list, $._value_use_and_type],
  ],

  // Token-level precedence constants (higher wins the token race):
  //   20 — Tier-1 structural op keywords (func.func, llvm.func, module, builtin.module)
  //        Must beat _dotted_op_name (10) so the parser treats these as Tier-1 ops,
  //        not as generic dialect.op names.
  //   10 — Tier-2 _dotted_op_name / _bare_op_name
  //        Must beat bare_id so op names at the start of a body element close
  //        the previous operation rather than extending it.
  //    5 — Builtin type tokens (i32, f32, index, none, …)
  //        Must beat bare_id so primitive type names aren't swallowed as keywords.
  //    2 — $.type inside _custom_body_element
  //        Gives type nodes priority over other body elements when both are
  //        syntactically valid.
  rules: {
    // =========================================================================
    // Top level production:
    //   (operation | attribute-alias-def | type-alias-def)
    // =========================================================================
    toplevel: $ => seq($._toplevel, repeat($._toplevel)),
    _toplevel: $ => choice($.operation, $.attribute_alias_def, $.type_alias_def),

    // =========================================================================
    // Common syntax (lang-ref)
    //  integer-literal ::= decimal-literal | hexadecimal-literal
    //  decimal-literal ::= digit+
    //  hexadecimal-literal ::= `0x` hex_digit+
    //  float-literal ::= [-+]?[0-9]+[.][0-9]*([eE][-+]?[0-9]+)?
    //  string-literal  ::= `"` [^"\n\f\v\r]* `"`
    // =========================================================================
    _digit: $ => /[0-9]/,
    integer_literal: $ => choice($._decimal_literal, $._hexadecimal_literal),
    _decimal_literal: $ => token(seq(optional(/[-+]/), repeat1(/[0-9]/))),
    _hexadecimal_literal: $ => token(seq('0x', repeat1(/[0-9a-fA-F]/))),
    float_literal: $ => token(seq(
      optional(/[-+]/), repeat1(/[0-9]/), '.', repeat(/[0-9]/),
      optional(seq(/[eE]/, optional(/[-+]/), repeat1(/[0-9]/))))),
    // NOTE: escape sequences (\n, \t, \", \\) are included per MLIR spec.
    // To also expose escape_sequence as a named AST node (for @string.escape),
    // this rule needs to become structural (seq instead of token). However,
    // doing so shifts parser states and currently breaks the external scanner
    // interaction with tree-sitter 0.26.6. The token form is kept for now;
    // regenerate with a CLI version that produces a compatible parser.c first.
    string_literal: $ => token(seq(
      '"',
      repeat(choice(/[^\\"\n\f\v\r]+/, seq('\\', /[nt"\\]/))),
      '"'
    )),
    bool_literal: $ => token(choice('true', 'false')),
    unit_literal: $ => token('unit'),
    uninitialized_literal: $ => token('uninitialized'),
    complex_literal: $ => seq('(', choice($.integer_literal, $.float_literal), ',',
      choice($.integer_literal, $.float_literal), ')'),
    tensor_literal: $ => seq(token(choice('dense', 'sparse')), '<',
      optional(choice(seq($.nested_idx_list, repeat(seq(',', $.nested_idx_list))),
        $._primitive_idx_literal)), '>'),
    array_literal: $ => seq(token('array'), '<', $.type, optional(seq(':', $._idx_list)), '>'),
    _literal: $ => choice($.integer_literal, $.float_literal, $.string_literal, $.bool_literal,
      $.tensor_literal, $.array_literal, $.unit_literal, $.uninitialized_literal),

    nested_idx_list: $ => seq('[', optional(choice($.nested_idx_list, $._idx_list)),
      repeat(seq(',', $.nested_idx_list)), ']'),
    _idx_list: $ => prec.right(seq($._primitive_idx_literal,
      repeat(seq(',', $._primitive_idx_literal)))),
    _primitive_idx_literal: $ => choice($.integer_literal, $.float_literal,
      $.bool_literal, $.complex_literal),

    // =========================================================================
    // Identifiers
    //   bare-id ::= (letter|[_]) (letter|digit|[_$.])*
    //   value-id ::= `%` suffix-id
    //   suffix-id ::= (digit+ | ((letter|id-punct) (letter|id-punct|digit)*))
    //   symbol-ref-id ::= `@` (suffix-id | string-literal) (`::` symbol-ref-id)?
    // =========================================================================
    bare_id: $ => token(seq(/[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$.]/))),
    _alias_or_dialect_id: $ => token(seq(/[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$]/))),
    bare_id_list: $ => seq($.bare_id, repeat(seq(',', $.bare_id))),
    value_use: $ => seq('%', $._suffix_id),
    _suffix_id: $ => token(seq(choice(repeat1(/[0-9]/),
      seq(/[a-zA-Z_$.-]/, repeat(/[a-zA-Z0-9_$.-]/))),
      optional(seq(choice(':', '#'), repeat1(/[0-9]/))))),
    symbol_ref_id: $ => seq('@', choice($._suffix_id, $.string_literal),
      optional(seq('::', $.symbol_ref_id))),
    _value_use_list: $ => seq($.value_use, repeat(seq(',', $.value_use))),

    // =========================================================================
    // Operations
    //   operation         ::= op-result-list? (generic-operation |
    //                         custom-operation) trailing-location?
    //   generic-operation ::= string-literal `(` value-use-list? `)`
    //                         successor-list? region-list?
    //                         dictionary-attribute? `:` function-type
    //   custom-operation  ::= bare-id custom-operation-format
    // =========================================================================
    operation: $ => seq(
      field('lhs', optional($._op_result_list)),
      field('rhs', choice($.generic_operation, $.custom_operation)),
      field('location', optional($.trailing_location))),

    generic_operation: $ =>
      seq($.string_literal, $._value_use_list_parens, optional($._successor_list),
        optional($._region_list), optional($.attribute), ':', $.function_type),

    _op_result_list: $ => seq($.op_result, repeat(seq(',', $.op_result)), '='),
    op_result: $ => seq($.value_use, optional(seq(':', $.integer_literal))),
    _successor_list: $ => seq('[', $.successor, repeat(seq(',', $.successor)), ']'),
    successor: $ => prec.right(seq($.caret_id, optional($._value_arg_list))),
    _region_list: $ => seq('(', $.region, repeat(seq(',', $.region)), ')'),
    dictionary_attribute: $ => seq('{', optional($.attribute_entry),
      repeat(seq(',', $.attribute_entry)), '}'),
    trailing_location: $ => seq(token('loc'), '(', $.location, ')'),
    location: $ => $.string_literal,

    // =========================================================================
    // Three-tier custom operation system
    //
    // Tier 1: func_operation, module_operation — structural ops for navigation
    // Tier 2: _generic_custom_operation — all other dialect.op_name patterns
    // =========================================================================
    custom_operation: $ => choice(
      prec(2, $.func_operation),
      prec(2, $.module_operation),
      $._generic_custom_operation,
    ),

    // Tier 1: Function operations (func.func, llvm.func)
    // Token prec 20 ensures these keywords win over _dotted_op_name (prec 10)
    func_operation: $ => prec.right(seq(
      field('name', choice(token(prec(20, 'func.func')), token(prec(20, 'llvm.func')))),
      field('visibility', optional('private')),
      field('sym_name', $.symbol_ref_id),
      field('arguments', $.func_arg_list),
      field('return', optional($.func_return)),
      field('attributes', optional(seq(optional(token('attributes')), $.attribute))),
      field('body', optional($.region)),
    )),

    // Tier 1: Module operations (module, builtin.module)
    module_operation: $ => prec.right(seq(
      field('name', choice(token(prec(20, 'builtin.module')), token(prec(20, 'module')))),
      field('sym_name', optional($.symbol_ref_id)),
      field('attributes', optional(seq(optional(token('attributes')), $.attribute))),
      field('body', $.region),
    )),

    // Tier 2: Generic custom operation — dialect.op_name + structural body
    // Negative dynamic precedence makes the parser prefer ending the body
    // and starting a new operation (with _op_result_list) over extending
    // the body with more elements, when both paths are valid (GLR).
    _generic_custom_operation: $ => prec.dynamic(-1, prec.right(seq(
      field('name', $.custom_op_name),
      repeat($._custom_body_element),
    ))),

    // Operation name: dotted form (arith.addi, scf.forall.in_parallel)
    // or known bare names (return, call, constant, etc.)
    // High token precedence (prec 10) ensures these win over bare_id at the
    // token level, forcing the parser to start a new operation rather than
    // continuing the body of the previous one.
    custom_op_name: $ => choice($._dotted_op_name, $._bare_op_name),
    _dotted_op_name: $ => token(prec(10, seq(
      /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$]/),
      repeat1(seq('.', /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$.]/))),
    ))),
    // Bare operation names: stable aliases from the func/builtin dialects only.
    // Extend only for officially spec-sanctioned no-prefix aliases; all other
    // dialect ops are handled by _dotted_op_name or _generic_custom_operation.
    _bare_op_name: $ => token(prec(10, choice(
      'return', 'call', 'call_indirect', 'constant', 'unrealized_conversion_cast',
    ))),

    // Structural body elements that can appear in custom operation format.
    // These are recognized by sigils (%,^,@,!,#) or by structural delimiters.
    _custom_body_element: $ => choice(
      $.value_use,              // %foo, %0
      $.symbol_ref_id,          // @sym, @"string"
      $.successor,              // ^bb0, ^bb0(%arg : type)
      prec(2, $.type),          // !type, i32, memref<...>, etc.
      $.attribute,              // #attr, {dict}, affine_map<...>
      $.region,                 // { ... } (regions with operations)
      $._custom_body_paren,     // ( ... )
      $._custom_body_bracket,   // [ ... ]
      $.combining_kind,         // <add>, <mul>, <newline>, etc. (enum attrs)
      $._literal,               // 42, 3.14, "string", true, dense<...>
      $.bare_id,                // keywords: to, from, step, ins, outs, etc.
      ',', '=', ':', '->',
    ),

    // combining-kind ::= `<` bare-id `>`
    // Used by vector.reduction, vector.print, sparse_tensor ops, etc.
    // Represents enum-valued attributes written with angle brackets in custom
    // assembly format (e.g. <add>, <mul>, <newline>).
    combining_kind: $ => seq('<', $.bare_id, '>'),

    _custom_body_paren: $ => seq('(', repeat($._custom_body_element), ')'),
    _custom_body_bracket: $ => seq('[', repeat($._custom_body_element), ']'),

    // =========================================================================
    // Blocks
    //   block       ::= block-label operation+
    //   block-label ::= block-id block-arg-list? `:`
    //   caret-id    ::= `^` suffix-id
    // =========================================================================
    block: $ => seq($.block_label, repeat1($.operation)),
    block_label: $ => seq($._block_id, optional($.block_arg_list), ':'),
    _block_id: $ => $.caret_id,
    caret_id: $ => seq('^', $._suffix_id),
    _value_use_and_type: $ => seq($.value_use, optional(seq(':', $.type))),
    _value_use_and_type_list: $ => seq($._value_use_and_type,
      repeat(seq(',', $._value_use_and_type))),
    block_arg_list: $ => seq('(', optional($._value_use_and_type_list), ')'),
    _value_arg_list: $ => seq('(', optional(choice(
      $._value_use_type_list,       // bulk format: (%v0, %v1 : t0, t1)
      $._value_use_and_type_list,   // per-pair format: (%v0 : t0, %v1 : t1)
    )), ')'),
    _value_use_type_list: $ => seq($._value_use_list, ':', $._type_list_no_parens),

    // =========================================================================
    // Regions
    //   region      ::= `{` entry-block? block* `}`
    //   entry-block ::= operation+
    // =========================================================================
    region: $ => seq('{', optional($.entry_block), repeat($.block), '}'),
    entry_block: $ => repeat1($.operation),

    // =========================================================================
    // Types
    //   type ::= type-alias | dialect-type | builtin-type
    //   function-type ::= (type | type-list-parens) `->` (type | type-list-parens)
    // =========================================================================
    type: $ => choice($.type_alias, $.dialect_type, $.builtin_type),
    _type_list_no_parens: $ => prec.left(seq($.type, repeat(seq(',', $.type)))),
    _type_list_parens: $ => seq('(', optional($._type_list_no_parens), ')'),
    function_type: $ => seq(choice($.type, $._type_list_parens), $._function_return),
    _function_return: $ => seq(token('->'), choice($.type, $._type_list_parens)),
    _type_annotation: $ => seq(':', $._type_list_no_parens),
    _function_type_annotation: $ => seq(':', $.function_type),
    _literal_and_type: $ => seq($._literal, optional($._type_annotation)),

    // Type aliases
    type_alias_def: $ => seq('!', $._alias_or_dialect_id, '=', $.type),
    type_alias: $ => seq('!', $._alias_or_dialect_id),

    // Dialect Types
    dialect_type: $ => seq(
      '!', choice($.opaque_dialect_item, $.pretty_dialect_item)),
    dialect_namespace: $ => $._alias_or_dialect_id,
    dialect_ident: $ => $._alias_or_dialect_id,
    opaque_dialect_item: $ => seq($.dialect_namespace, '<', $.string_literal, '>'),
    pretty_dialect_item: $ => seq($.dialect_namespace, '.', $.dialect_ident,
      optional($.pretty_dialect_item_body)),
    pretty_dialect_item_body: $ => seq('<', repeat($._pretty_dialect_item_contents), '>'),
    _pretty_dialect_item_contents: $ => prec.left(choice(
      $.pretty_dialect_item_body,
      $.type,
      $.attribute,
      $._literal,
      $.bare_id,
      ',', ':', '=', '->', '(', ')', '[', ']', '{', '}',
      token(prec(-1, /[^<>]/))
    )),

    // Builtin types
    builtin_type: $ => choice(
      $.integer_type,
      $.float_type,
      $.complex_type,
      $.index_type,
      $.memref_type,
      $.none_type,
      $.tensor_type,
      $.vector_type,
      $.tuple_type,
      $.opaque_type),

    integer_type: $ => token(prec(5, seq(choice('si', 'ui', 'i'), /[1-9]/, repeat(/[0-9]/)))),
    float_type: $ => token(prec(5, choice('f16', 'tf32', 'f32', 'f64', 'f80', 'f128', 'bf16',
      'f4E2M1FN', 'f6E2M3FN', 'f6E3M2FN', 'f8E3M4', 'f8E4M3', 'f8E4M3FN', 'f8E4M3FNUZ',
      'f8E4M3B11FNUZ', 'f8E5M2', 'f8E5M2FNUZ', 'f8E8M0FNU'))),
    index_type: $ => token(prec(5, 'index')),
    none_type: $ => token(prec(5, 'none')),
    complex_type: $ => seq(token('complex'), '<', $._prim_type, '>'),
    _prim_type: $ => choice($.integer_type, $.float_type, $.index_type,
      $.complex_type, $.none_type, $.memref_type, $.vector_type, $.tensor_type,
      $.opaque_type),

    memref_type: $ => seq(token('memref'), '<',
      field('dimension_list', $.dim_list),
      optional(seq(',', $.attribute_value)),
      optional(seq(',', $.attribute_value)), '>'),
    dim_list: $ => seq($._dim_primitive, repeat(seq('x', $._dim_primitive))),
    // NOTE: '*' is only valid in memref (dynamic offset/stride), not in tensor
    // or vector dimension lists. The grammar accepts it permissively here to
    // avoid a separate rule; strict validation is left to semantic analysis.
    dimension_size: $ => repeat1($._digit),
    _dim_primitive: $ => choice(prec(1, $.type), $.dimension_size, '?', '*'),

    tensor_type: $ => seq(token('tensor'), '<', $.dim_list,
      optional(seq(',', $.tensor_encoding)), '>'),
    tensor_encoding: $ => $.attribute_value,

    vector_type: $ => seq(token('vector'), '<', repeat($.vector_dim_list), $._prim_type, '>'),
    vector_dim_list: $ => prec.left(choice(seq($._static_dim_list, 'x',
      optional(seq('[', $._static_dim_list, ']', 'x'))), seq('[', $._static_dim_list, ']', 'x'))),
    _static_dim_list: $ => seq($.dimension_size, repeat(seq('x', $.dimension_size))),

    tuple_type: $ => seq(token('tuple'), '<', $.tuple_dim, repeat(seq(',', $.tuple_dim)), '>'),
    tuple_dim: $ => $._prim_type,

    // opaque-type ::= `opaque` `<` string-literal `,` string-literal `>`
    // e.g. opaque<"llvm", "struct<(i32, float)>">
    opaque_type: $ => seq(token('opaque'), '<', $.string_literal, ',', $.string_literal, '>'),

    // =========================================================================
    // Attributes
    //   attribute-entry ::= (bare-id | string-literal) `=` attribute-value
    //   attribute-value ::= attribute-alias | dialect-attribute | builtin-attribute
    // =========================================================================
    attribute_entry: $ => choice(
      seq(choice($.bare_id, $.string_literal), optional(seq('=', $.attribute_value))),
      // Array-valued entry (e.g. {["op.name"]} in transform dialect)
      seq('[', optional($._attribute_value_nobracket),
        repeat(seq(',', $._attribute_value_nobracket)), ']'),
    ),
    attribute_value: $ => choice(seq('[', optional($._attribute_value_nobracket),
      repeat(seq(',', $._attribute_value_nobracket)), ']'), $._attribute_value_nobracket),
    _attribute_value_nobracket: $ => choice($.attribute_alias, $.dialect_attribute,
      $.builtin_attribute, $.dictionary_attribute, $._literal_and_type, $.type),
    attribute: $ => choice($.attribute_alias, $.dialect_attribute,
      $.builtin_attribute, $.dictionary_attribute),

    // Attribute aliases
    attribute_alias_def: $ => seq('#', $._alias_or_dialect_id, '=', $.attribute_value),
    attribute_alias: $ => seq('#', $._alias_or_dialect_id),

    // Dialect attributes
    dialect_attribute: $ => seq('#', choice($.opaque_dialect_item, $.pretty_dialect_item)),

    // Builtin attributes
    builtin_attribute: $ => choice(
      $.strided_layout,
      $.affine_map,
      $.affine_set,
      $.dense_resource_literal,
    ),
    dense_resource_literal: $ => seq(token('dense_resource'), '<',
      choice($.bare_id, $.string_literal), '>'),
    strided_layout: $ => seq(token('strided'), '<', '[', $._dim_list_comma, ']',
      optional(seq(',', token('offset'), ':', choice($.integer_literal, '?', '*'))), '>'),
    _dim_list_comma: $ => seq($._dim_primitive, repeat(seq(',', $._dim_primitive))),

    // =========================================================================
    // Affine expressions
    // =========================================================================
    affine_map: $ => seq(token('affine_map'), '<', $._multi_dim_affine_expr_parens,
      optional($._multi_dim_affine_expr_sq), token('->'), $._multi_dim_affine_expr_parens, '>'),
    affine_set: $ => seq(token('affine_set'), '<', $._multi_dim_affine_expr_parens,
      optional($._multi_dim_affine_expr_sq), ':', $._multi_dim_affine_expr_parens, '>'),
    _multi_dim_affine_expr_parens: $ => seq('(', optional($._multi_dim_affine_expr), ')'),
    _multi_dim_affine_expr_sq: $ => seq('[', optional($._multi_dim_affine_expr), ']'),

    _multi_dim_affine_expr: $ => seq($._affine_expr, repeat(seq(',', $._affine_expr))),
    _affine_expr: $ => prec.right(choice(seq('(', $._affine_expr, ')'), seq('-', $._affine_expr),
      seq($._affine_expr, $._affine_token, $._affine_expr), $._affine_prim)),
    _affine_prim: $ => choice($.integer_literal, $.value_use, $.bare_id,
      seq('symbol', '(', $.value_use, ')'), seq(choice('max', 'min'), '(', $._value_use_list, ')')),
    _affine_token: $ => token(choice(
      // arithmetic
      '+', '-', '*', 'ceildiv', 'floordiv', 'mod',
      // comparisons (used in affine_set constraints)
      '==', '>=', '<=',
    )),

    // =========================================================================
    // Function-related rules (used by func_operation tier-1)
    // =========================================================================
    func_return: $ => seq(token('->'), $.type_list_attr_parens),
    func_arg_list: $ => seq('(', optional(choice($.variadic,
      $._value_id_and_type_attr_list)), ')'),
    _value_id_and_type_attr_list: $ => seq($._value_id_and_type_attr,
      repeat(seq(',', $._value_id_and_type_attr)), optional(seq(',', $.variadic))),
    _value_id_and_type_attr: $ => seq($._function_arg, optional($.attribute)),
    _function_arg: $ => choice(seq($.value_use, ':', $.type), $.value_use, $.type),
    type_list_attr_parens: $ => choice($.type, seq('(', $.type, optional($.attribute),
      repeat(seq(',', $.type, optional($.attribute))), ')'), seq('(', ')')),
    variadic: $ => token('...'),

    // =========================================================================
    // Shared helpers
    // =========================================================================
    _value_use_list_parens: $ => seq('(', optional($._value_use_list), ')'),

    // Comment (standard BCPL)
    comment: $ => token(seq('//', /.*/)),
  }
});
