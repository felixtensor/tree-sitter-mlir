/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// ---------------------------------------------------------------------------
// Grammar DSL helpers (pure expansion; keep generated grammar.json flat)
// ---------------------------------------------------------------------------

// prettier-ignore
/** @param {RuleOrLiteral} rule */
const commaSep1 = rule => seq(rule, repeat(seq(',', rule)));

// prettier-ignore
/** @param {RuleOrLiteral} rule */
const commaSep = rule => optional(commaSep1(rule));

// Shared quoted-string body for string_literal and scanner-opened generic op names.
// prettier-ignore
const stringContent = $ => choice(
  // Beat `$.comment` so `//` inside a string does not lex as a comment.
  token(prec(1, /[^\\"\n\f\v\r]+/)),
  $.escape_sequence,
  $.invalid_escape,
);

// Non-region, non-dictionary lead token (or pair) after `{` in a custom body.
// prettier-ignore
const braceStart = ($, follow, paren) => choice(
  $.symbol_ref_id, $._custom_body_angle_group,
  $.integer_literal, $.float_literal, $.variadic,
  '=', ':', '->', $._custom_body_operator_start,
  // String key precedes `=`, `,`, `}`; generic op name precedes `(`.
  seq($.string_literal, choice(follow, ':')),
  // Value starts a result list before `,`, `=`, `:`.
  seq($.value_use, choice(follow, paren)),
);

// Nested custom-body element other than `(...)`, `,`, `=`, `:`.
// prettier-ignore
const braceFollow = ($, braced, bracket) => choice(
  $._custom_body_reference_element,
  $._custom_body_type_element,
  braced,
  $._custom_body_dialect_marker,
  bracket,
  $._custom_body_angle_group,
  $._custom_body_atom,
  '->', $._custom_body_operator_punctuation,
  $.trailing_location,
);

// prettier-ignore
export default grammar({
  name: 'mlir',
  extras: $ => [/[\s\x00]/, $.comment],

  externals: $ => [
    $._caret_id,
    $._block_label_id,
    $._custom_body_dimension_separator,
    $._op_result_sigil,
    $._generic_op_quote,
    // Opaque only when scanner proves `{...}` is no region, dict, or known payload.
    $._custom_body_opaque_brace_group,
    $._attribute_alias_sigil,
    $._type_alias_sigil,
    $._custom_body_unclosed_brace_prefix,
    $._recovery_dotted_op_name,
    // Never emitted or referenced in rules; valid only in error recovery.
    $._error_sentinel,
    $._custom_body_module_keyword,
    $._pretty_dialect_fallback,
  ],

  // All 13 conflicts are load-bearing; full rationale in docs/ARCHITECTURE.md.
  conflicts: $ => [
    // ── Core MLIR (2) ───────────────────────────────────────────────────────
    [$._value_use_list, $._value_use_and_type], // parens: value list vs value:type
    [$._type_list_no_parens, $._type_or_func_type], // results: type list vs single entry

    // ── Custom-body fallback (9) ────────────────────────────────────────────
    [$.custom_op_name, $.attribute_entry], // bare id: next op vs attr key
    [$.custom_op_name, $._custom_body_enum_brace_group, $.attribute_entry], // bare key before `=`
    [$._custom_body_enum_brace_group, $.attribute_entry], // attr prefix before bare enum
    [$.array_literal, $._custom_body_array_keyword], // `array` introducer vs keyword
    [$._custom_body_tensor_keyword, $.tensor_type], // `tensor` introducer vs keyword
    [$._generic_custom_operation_with_location_attr_dict, $.custom_op_name], // dotted op `loc(...) {dict}`
    [$._custom_body_dict_key, $.attribute_entry], // `"key" = ...`: SSA dict vs attr entry
    [$.op_result, $._custom_body_brace_group], // `{%a, %b}` payload vs `{%a, %b = op}` region
    [$._custom_body_element_base, $._custom_body_typed_arg_attr], // type `{id}` in `(...)`: arg attr wins dynamically

    // ── Pretty-dialect body (2) ─────────────────────────────────────────────
    [$._pretty_dialect_item_contents, $.tensor_type], // `tensor` keyword vs builtin type
    [$._pretty_dialect_item_contents, $.opaque_type], // `opaque` keyword vs builtin type
  ],

  inline: $ => [
    $._tier1_custom_operation, $._tier2_custom_operation,
    $._custom_body_reference_element, $._custom_body_type_element,
    $._custom_body_attribute_or_braced_element, $._custom_body_dialect_marker,
    $._custom_body_group, $._custom_body_atom, $._custom_body_literal_element,
    $._custom_body_reserved_keyword, $._custom_body_affine_keyword,
    $._custom_body_brace_payload, $._custom_body_brace_start,
    $._custom_body_angle_brace_start, $._custom_body_angle_braced_element,
    $._custom_body_operator_start, $._custom_body_punctuation,
    $._custom_body_separator_punctuation, $._custom_body_operator_punctuation,
    $._pretty_dialect_structural_content, $._pretty_dialect_value_content,
    $._pretty_dialect_keyword_content, $._pretty_dialect_punctuation_content,
  ],

  // Precedence tiers:
  //   20 — Tier-1 op keywords (func.func, llvm.func, module, builtin.module) > _dotted_op_name
  //   10 — Tier-2 _dotted_op_name / _bare_op_name > bare_id (terminates prior custom body)
  //    5 — Builtin primitive types (i32, f32, index, none, token) > bare_id
  //    2 — $.type inside _custom_body_element > other body elements
  rules: {
    // =========================================================================
    // Top level
    // =========================================================================
    toplevel: $ => repeat($._toplevel),
    _toplevel: $ => choice(
      $.operation, $.attribute_alias_def, $.type_alias_def, $.external_resources,
    ),
    external_resources: $ => seq('{-#', repeat($._external_resource_content), '#-}'),
    _external_resource_content: $ => choice(
      $.string_literal,
      // YAML-like metadata; keep loose so keys like `dense_resource_test_2xi32` stay intact.
      token(prec(-1, /[^#"\/]+/)),
      '#', '/',
    ),

    // =========================================================================
    // Literals
    // =========================================================================
    _digit: $ => /[0-9]/,
    integer_literal: $ => choice($._decimal_literal, $._hexadecimal_literal),
    _decimal_literal: $ => token(seq(optional(/[-+]/), repeat1(/[0-9]/))),
    _unsigned_decimal_literal: $ => token(repeat1(/[0-9]/)),
    _unsigned_integer_literal: $ => choice($._unsigned_decimal_literal, $._hexadecimal_literal),
    _hexadecimal_literal: $ => token(seq('0x', repeat1(/[0-9a-fA-F]/))),
    float_literal: $ => token(seq(
      optional(/[-+]/), repeat1(/[0-9]/), '.', repeat(/[0-9]/),
      optional(seq(/[eE]/, optional(/[-+]/), repeat1(/[0-9]/))),
    )),
    string_literal: $ => seq('"', repeat(stringContent($)), '"'),
    _generic_op_name: $ => seq(alias($._generic_op_quote, '"'), repeat(stringContent($)), '"'),
    escape_sequence: $ => token(seq('\\', choice(/[nt"\\]/, /[0-9a-fA-F]{2}/))),
    invalid_escape: $ => token(seq('\\', /[^\n\f\v\r]/)),
    bool_literal: $ => token(choice('true', 'false')),
    unit_literal: $ => token('unit'),
    uninitialized_literal: $ => token('uninitialized'),
    complex_literal: $ => seq(
      '(', choice($.integer_literal, $.float_literal, $.bool_literal),
      ',', choice($.integer_literal, $.float_literal, $.bool_literal), ')',
    ),
    tensor_literal: $ => seq(
      choice($._dense_keyword, $._sparse_keyword), '<',
      optional(seq(optional(seq($.type, ':')), commaSep1($._tensor_literal_element))),
      '>',
    ),
    _tensor_literal_element: $ => choice($.nested_idx_list, $._primitive_element),
    array_literal: $ => seq(token('array'), '<', $.type, optional(seq(':', $._idx_list)), '>'),
    _literal: $ => choice(
      $.integer_literal, $.float_literal, $.string_literal, $.bool_literal,
      $.tensor_literal, $.array_literal, $.unit_literal, $.uninitialized_literal,
    ),

    nested_idx_list: $ => seq(
      '[', optional(choice($.nested_idx_list, $._idx_list)),
      repeat(seq(',', $.nested_idx_list)), ']',
    ),
    _idx_list: $ => prec.right(commaSep1($._primitive_element)),
    _primitive_element: $ => seq($._primitive_idx_literal, optional(seq(':', $.type))),
    _primitive_idx_literal: $ => choice(
      $.integer_literal, $.float_literal, $.bool_literal, $.complex_literal, $.string_literal,
    ),

    // =========================================================================
    // Identifiers
    // =========================================================================
    bare_id: $ => token(seq(/[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$.]/))),
    _alias_or_dialect_id: $ => token(seq(/[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$]/))),
    bare_id_list: $ => commaSep1($.bare_id),
    value_use: $ => seq('%', $._suffix_id),
    _suffix_id: $ => token(seq(
      choice(repeat1(/[0-9]/), seq(/[a-zA-Z_$.-]/, repeat(/[a-zA-Z0-9_$.-]/))),
      optional(seq(choice(':', '#'), repeat1(/[0-9]/))),
    )),
    symbol_ref_id: $ => seq('@', choice($._suffix_id, $.string_literal), optional(seq('::', $.symbol_ref_id))),
    _value_use_list: $ => commaSep1($.value_use),

    // =========================================================================
    // Operations
    // =========================================================================
    operation: $ => seq(
      optional($._op_result_list),
      field('rhs', choice($.generic_operation, $.custom_operation)),
      field('location', optional($.trailing_location)),
    ),

    // Scanner opens line-start generic op names with `_generic_op_quote` so a
    // preceding custom body cannot absorb them; both paths emit `string_literal`.
    generic_operation: $ => seq(
      choice(alias($._generic_op_name, $.string_literal), $.string_literal),
      $._value_use_list_parens,
      optional($._successor_list),
      optional($.properties),
      optional($._region_list),
      optional($.attribute),
      ':', $.function_type,
    ),

    // Keep `,` and `=` outside `lhs` so field queries return only `op_result`.
    _op_result_list: $ => seq(field('lhs', $.op_result), repeat(seq(',', field('lhs', $.op_result))), '='),
    // Scanner emits `_op_result_sigil` for line-start result bindings so a
    // preceding custom body stops; both paths emit `value_use`.
    op_result: $ => seq(
      choice(alias($._op_result_value, $.value_use), $.value_use),
      optional(seq(':', $.integer_literal)),
    ),
    _op_result_value: $ => seq(alias($._op_result_sigil, '%'), $._suffix_id),
    _successor_list: $ => seq('[', $.successor, repeat(seq(',', $.successor)), ']'),
    successor: $ => prec.right(seq($.caret_id, optional($._value_arg_list))),
    _region_list: $ => seq('(', $.region, repeat(seq(',', $.region)), ')'),
    properties: $ => seq('<', '{', optional($.attribute_entry), repeat(seq(',', $.attribute_entry)), '}', '>'),
    // Custom prop-dict `<key = value>` form (separate from generic `<{...}>`); aliased to `properties`.
    _keyed_properties: $ => seq('<', commaSep($.attribute_entry), '>'),
    dictionary_attribute: $ => seq('{', optional($.attribute_entry), repeat(seq(',', $.attribute_entry)), '}'),

    // Source locations (LangRef)
    trailing_location: $ => seq(token('loc'), '(', $.location, ')'),
    location: $ => choice(
      $.unknown_location, $._string_location, $.callsite_location,
      $.fused_location, $.attribute_alias, $.dialect_attribute,
    ),
    unknown_location: $ => token('unknown'),
    callsite_location: $ => seq(token('callsite'), '(', $.location, token('at'), $.location, ')'),
    fused_location: $ => seq(
      token('fused'), optional(seq('<', $.attribute_value, '>')),
      '[', $.location, repeat(seq(',', $.location)), ']',
    ),
    // Shared prefix for name-location (`"name"(loc)`) and filelinecol (`"file":l:c`).
    _string_location: $ => seq($.string_literal, optional(choice($._filelinecol_suffix, seq('(', $.location, ')')))),
    _filelinecol_suffix: $ => seq(
      ':', $.integer_literal,
      optional(seq(':', $.integer_literal)),
      optional(seq(token('to'), optional($.integer_literal), ':', $.integer_literal)),
    ),

    // =========================================================================
    // Two-tier custom operation system
    //   Tier 1: func_operation, module_operation, _affine_for_operation
    //   Tier 2: _generic_custom_operation (+ specialized loc forms)
    // =========================================================================
    custom_operation: $ => choice($._tier1_custom_operation, $._tier2_custom_operation),
    _tier1_custom_operation: $ => choice(
      prec(2, $.func_operation),
      prec(2, $.module_operation),
      prec(2, $._affine_for_operation),
    ),
    _tier2_custom_operation: $ => choice(
      $._pdl_interp_record_match_operation,
      $._generic_custom_operation_with_location_attr_dict,
      $._generic_custom_operation,
    ),

    // Tier 1: func.func / llvm.func (prec 20 beats _dotted_op_name)
    func_operation: $ => prec.right(choice(
      seq(
        field('name', token(prec(20, 'func.func'))),
        field('visibility', optional(choice('public', 'private', 'nested'))),
        field('sym_name', $.symbol_ref_id),
        field('arguments', $.func_arg_list),
        field('return', optional($.func_return)),
        // Keep `"attributes"` unfielded so `attributes` labels only the dictionary.
        optional(seq(optional(token('attributes')), field('attributes', $.dictionary_attribute))),
        field('body', optional($.region)),
      ),
      seq(
        field('name', token(prec(20, 'llvm.func'))),
        // Broad specifier list (linkage, visibility, unnamed_addr, ~50 CConvs); `@sym` terminates.
        repeat(field('specifier', alias($.bare_id, $.function_specifier))),
        field('sym_name', $.symbol_ref_id),
        field('arguments', $.func_arg_list),
        field('return', optional($.func_return)),
        field('vscale_range', optional($.vscale_range)),
        field('comdat', optional($.comdat)),
        // Keep `"attributes"` unfielded so `attributes` labels only the dictionary.
        optional(seq(optional(token('attributes')), field('attributes', $.dictionary_attribute))),
        field('body', optional($.region)),
      ),
    )),

    vscale_range: $ => seq('vscale_range', '(', $.integer_literal, ',', $.integer_literal, ')'),
    comdat: $ => seq('comdat', '(', $.symbol_ref_id, ')'),

    // Tier 1: module / builtin.module
    module_operation: $ => prec.right(seq(
      field('name', choice(token(prec(20, 'builtin.module')), token(prec(20, 'module')))),
      field('sym_name', optional($.symbol_ref_id)),
      field('properties', optional(choice($.properties, alias($._keyed_properties, $.properties)))),
      // Keep `"attributes"` unfielded so `attributes` labels only the attribute.
      optional(seq(optional(token('attributes')), field('attributes', $.attribute))),
      field('body', $.region),
    )),

    // Captures induction-variable `loc(...)` before `=` so it doesn't consume
    // the operation's own trailing location slot.
    _affine_for_operation: $ => prec.right(seq(
      field('name', alias(token(prec(20, 'affine.for')), $.custom_op_name)),
      $.value_use,
      optional(field('induction_location', $.trailing_location)),
      repeat($._custom_body_element),
    )),

    // Keeps `loc([%v, ...])` inside the op body instead of the trailing location slot.
    _pdl_interp_record_match_operation: $ => prec.dynamic(-1, prec.right(seq(
      field('name', alias(token(prec(20, 'pdl_interp.record_match')), $.custom_op_name)),
      repeat($._custom_body_element),
      $._custom_body_location_list,
      repeat($._custom_body_element),
    ))),

    // Tier 2: generic custom op. `prec.right` extends until a higher-prec op name
    // or scanner boundary; dynamic -1 prefers dicts/enum payloads over phantom regions.
    _generic_custom_operation: $ => prec.dynamic(-1, prec.right(seq(
      field('name', $.custom_op_name),
      repeat($._custom_body_element),
    ))),
    _generic_custom_operation_with_location_attr_dict: $ => prec.dynamic(-1, prec.right(seq(
      field('name', alias($._dotted_op_name, $.custom_op_name)),
      $._custom_body_location_attr_dict,
      repeat($._custom_body_element),
    ))),

    // Dotted and bare op names (prec 10) beat `bare_id` to terminate the prior body.
    // `bare_id` supports default-dialect ops only where no custom body can continue
    // (e.g. region/block start or after `=`).
    custom_op_name: $ => choice(
      $._dotted_op_name, $._bare_op_name, $.bare_id, $._recovery_dotted_op_name,
    ),
    _dotted_op_name: $ => token(prec(10, seq(
      /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$]/),
      repeat1(seq('.', /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$.]/))),
    ))),
    // Spec-sanctioned no-prefix aliases only. `constant` is omitted so global
    // modifiers stay inside `memref.global` / `llvm.mlir.global` (`%c = constant`
    // and region-start `constant` still parse via `bare_id`).
    _bare_op_name: $ => token(prec(10, choice(
      'return', 'call', 'call_indirect', 'unrealized_conversion_cast',
    ))),

    // ── Custom operation body elements ──────────────────────────────────────
    _custom_body_element: $ => choice(
      $.custom_body_dim_list,
      $._custom_body_element_base,
      $._custom_body_unclosed_brace_group,
      // Excluded from nested groups so `>` still closes angle groups.
      $._custom_body_successor_marker, // >^bb1 (WasmSSA)
    ),
    _custom_body_element_base: $ => choice(
      $._custom_body_reference_element,
      $._custom_body_type_element,
      $._custom_body_attribute_or_braced_element,
      $._custom_body_dialect_marker,
      $._custom_body_group,
      $._custom_body_atom,
      $._custom_body_punctuation,
    ),
    _custom_body_reference_element: $ => choice($.value_use, $.symbol_ref_id, $.successor),
    _custom_body_type_element: $ => prec(2, $.type),

    _custom_body_attribute_or_braced_element: $ => choice(
      $.attribute,
      alias($._custom_body_dotted_key_attribute, $.attribute),
      $._custom_body_opaque_brace_group,
      $.region,
      $._custom_body_brace_payload,
      $._custom_body_brace_group,
      $._custom_body_enum_brace_group,
    ),

    // `{a.b = ...}`: dotted key lexes as `_dotted_op_name`, which only `region`
    // accepts. Requiring `=` keeps `{ scf.yield }` a region; prec 1 settles statically.
    _custom_body_dotted_key_attribute: $ => alias($._custom_body_dotted_key_dictionary, $.dictionary_attribute),
    _custom_body_dotted_key_dictionary: $ => seq(
      '{', alias($._custom_body_dotted_key_entry, $.attribute_entry), repeat(seq(',', $.attribute_entry)), '}',
    ),
    _custom_body_dotted_key_entry: $ => prec(1, seq(
      field('key', alias($._dotted_op_name, $.bare_id)), '=', field('value', $.attribute_value),
    )),

    // Unit-key arg attribute immediately after a type inside `(...)`, e.g.
    // `(%arg0: !transform.any_op {transform.readonly})`. Dynamic +1 beats region.
    _custom_body_typed_arg_attr: $ => prec.dynamic(1, seq(
      $._custom_body_type_element,
      alias($._custom_body_unit_key_attribute, $.attribute),
    )),
    _custom_body_unit_key_attribute: $ => alias($._custom_body_unit_key_dictionary, $.dictionary_attribute),
    _custom_body_unit_key_dictionary: $ => seq(
      '{',
      alias($._custom_body_unit_key_entry, $.attribute_entry),
      repeat(seq(',', alias($._custom_body_unit_key_entry, $.attribute_entry))),
      '}',
    ),
    _custom_body_unit_key_entry: $ => choice(
      seq(field('key', alias($._dotted_op_name, $.bare_id)), optional(seq('=', field('value', $.attribute_value)))),
      seq(field('key', $.bare_id), optional(seq('=', field('value', $.attribute_value)))),
      seq(field('key', $.string_literal), optional(seq('=', field('value', $.attribute_value)))),
      $.array_attribute,
    ),

    // ── Custom-body brace payloads & recovery ───────────────────────────────
    _custom_body_brace_payload: $ => choice(
      $._custom_body_tuple_group, // {(%v), (%w)}
      $._custom_body_value_group, // {%v : type, ...}
      $._custom_body_ssa_dict, // {"attr" = %value, ...}
    ),
    // Scanner stops before a boundary; requiring `}` forces local error recovery.
    _custom_body_unclosed_brace_group: $ => seq($._custom_body_unclosed_brace_prefix, '}'),
    _custom_body_brace_group: $ => seq('{', choice(
      seq($._custom_body_brace_start, repeat($._nested_custom_body_element)),
      commaSep1($.value_use),
    ), '}'),
    // Requires a bare_id enum value so dicts keep their nodes. Keep separate
    // (and not inlined) so its conflicts stay decoupled from paren payloads.
    _custom_body_enum_brace_group: $ => seq(
      '{', repeat(seq($.bare_id, '=', $.attribute_value, ',')),
      $.bare_id, '=', $.bare_id, repeat($._nested_custom_body_element), '}',
    ),
    // Inside `<...>`, a bare key not followed by `=`/`,` is also a non-dict group (e.g. `struct<{a: i32}>`).
    _custom_body_angle_brace_group: $ => seq('{', choice(
      seq($._custom_body_angle_brace_start, repeat($._custom_body_angle_element)),
      seq(
        $.bare_id, choice($._custom_body_angle_brace_follow, $._custom_body_angle_paren, ':'),
        repeat($._custom_body_angle_element),
      ),
      commaSep1($.value_use),
    ), '}'),

    // No keyword may start this fallback (would out-lex dict keys / op names).
    // `#`, `!`, and non-label `^` leads are handled by `_custom_body_opaque_brace_group`.
    _custom_body_brace_start: $ => braceStart($, $._custom_body_brace_follow, $._custom_body_paren),
    _custom_body_angle_brace_start: $ => braceStart($, $._custom_body_angle_brace_follow, $._custom_body_angle_paren),
    _custom_body_operator_start: $ => choice('*', '?', '+', $._custom_body_minus_punctuation, '/', '&', '|', '~'),
    // Not inlined: keywords must reduce before `<`.
    _custom_body_brace_follow: $ => braceFollow($, $._custom_body_attribute_or_braced_element, $._custom_body_bracket),
    _custom_body_angle_brace_follow: $ => braceFollow(
      $, $._custom_body_angle_braced_element, $._custom_body_angle_bracket,
    ),

    // ── Custom-body markers, groups, atoms & punctuation ────────────────────
    _custom_body_dialect_marker: $ => choice(
      $.custom_body_arrow, // <- (OpenMP loop transform)
      $._custom_body_module_symbol_arg, // module @sym / module(@sym)
      $._custom_body_sparse_operand, // sparse(%idx : type)
    ),
    _custom_body_group: $ => choice($._custom_body_paren, $._custom_body_bracket, $._custom_body_angle_group),
    _custom_body_atom: $ => choice($._custom_body_literal_element, $._custom_body_reserved_keyword, $.bare_id),

    custom_body_dim_list: $ => prec.dynamic(1, seq(
      $._custom_body_dimension_size,
      repeat1(seq(alias($._custom_body_dimension_separator, $.dimension_separator), $._custom_body_dimension_size)),
    )),
    // Static (`16`) or dynamic (`?`). `*` is excluded because it collides with multiply.
    _custom_body_dimension_size: $ => choice(alias($.integer_literal, $.dimension_size), '?'),
    _custom_body_literal_element: $ => choice($.variadic, $._literal),
    _custom_body_reserved_keyword: $ => choice(
      $._custom_body_array_keyword,
      'vector',
      $._custom_body_tensor_keyword,
      $._custom_body_affine_keyword,
    ),
    _custom_body_array_keyword: $ => 'array',
    _custom_body_tensor_keyword: $ => 'tensor',
    _custom_body_affine_keyword: $ => choice('ceildiv', 'floordiv', 'mod'),

    _custom_body_punctuation: $ => choice($._custom_body_separator_punctuation, $._custom_body_operator_punctuation),
    _custom_body_separator_punctuation: $ => choice(',', '=', ':', '->'),
    _custom_body_operator_punctuation: $ => choice(
      '*', '?', $.dimension_separator, '+', $._custom_body_minus_punctuation, '/', '&', '|', '~',
    ),
    _custom_body_minus_punctuation: $ => '-',

    _custom_body_paren: $ => seq('(', repeat(choice($._custom_body_typed_arg_attr, $._nested_custom_body_element)), ')'),
    _custom_body_bracket: $ => seq('[', repeat($._nested_custom_body_element), ']'),
    _custom_body_value_group: $ => seq('{', $.value_use, ':', $.type, repeat(seq(',', $.value_use, ':', $.type)), '}'),
    _custom_body_tuple_group: $ => seq('{', $._custom_body_tuple, repeat(seq(',', $._custom_body_tuple)), '}'),
    _custom_body_tuple: $ => seq('(', $._value_use_list, ')'),
    _custom_body_location_attr_dict: $ => seq($.trailing_location, $.dictionary_attribute),
    _custom_body_ssa_dict: $ => seq(
      '{',
      repeat(seq($._custom_body_attr_dict_entry, ',')),
      $._custom_body_ssa_dict_entry,
      repeat(seq(',', $._custom_body_mixed_dict_entry)),
      '}',
    ),
    _custom_body_dict_key: $ => $.string_literal,
    _custom_body_attr_dict_entry: $ => seq($._custom_body_dict_key, '=', $.attribute_value),
    _custom_body_ssa_dict_entry: $ => seq(
      $._custom_body_dict_key, '=', choice($.value_use, $._custom_body_ssa_value_array),
    ),
    _custom_body_mixed_dict_entry: $ => seq(
      $._custom_body_dict_key, '=', choice($.attribute_value, $.value_use, $._custom_body_ssa_value_array),
    ),
    _custom_body_ssa_value_array: $ => seq('[', $.value_use, repeat(seq(',', $.value_use)), ']'),
    _custom_body_successor_marker: $ => seq('>', $.successor),
    _custom_body_module_symbol_arg: $ => seq(
      // Scanner consumes only `module` after ruling out a real module header.
      alias($._custom_body_module_keyword, 'module'),
      choice($.symbol_ref_id, seq('(', $.symbol_ref_id, ')')),
    ),
    _custom_body_sparse_operand: $ => seq($._sparse_keyword, $._custom_body_paren),
    _custom_body_location_list: $ => seq(token('loc'), '(', '[', optional($._value_use_list), ']', ')'),

    // `{...}` anywhere inside `<...>` (at any nesting depth) is never a region.
    _custom_body_angle_group: $ => seq('<', repeat($._custom_body_angle_element), '>'),
    _custom_body_angle_element: $ => choice(
      $._custom_body_reference_element,
      $._custom_body_type_element,
      $._custom_body_angle_braced_element,
      $._custom_body_dialect_marker,
      $._custom_body_angle_paren,
      $._custom_body_angle_bracket,
      $._custom_body_angle_group,
      $._custom_body_atom,
      $._custom_body_punctuation,
      $.trailing_location,
    ),
    _custom_body_angle_braced_element: $ => choice(
      $.attribute,
      $._custom_body_brace_payload,
      $._custom_body_opaque_brace_group,
      $._custom_body_angle_brace_group,
    ),
    _custom_body_angle_paren: $ => seq('(', repeat($._custom_body_angle_element), ')'),
    _custom_body_angle_bracket: $ => seq('[', repeat($._custom_body_angle_element), ']'),

    // OpenMP mapped-from arrow (`<-`). Kept as separate `<` and `-` tokens so a
    // length-2 token cannot mis-lex negative payloads like `#smt.bv<-1>`.
    custom_body_arrow: $ => prec(1, seq('<', '-')),

    // `trailing_location` is allowed only inside nested groups; at top level it
    // belongs to `operation.location`.
    _nested_custom_body_element: $ => choice($._custom_body_element_base, $.trailing_location),

    // =========================================================================
    // Blocks & Regions
    // =========================================================================
    block: $ => seq($.block_label, repeat($.operation)),
    block_label: $ => seq($._block_id, optional($.block_arg_list), ':'),
    _block_id: $ => alias($._block_label_id, $.caret_id),
    caret_id: $ => $._caret_id,
    _value_use_and_type: $ => seq(
      $.value_use,
      optional(seq(':', choice($.type, $.function_type))),
      optional($.trailing_location),
    ),
    _value_use_and_type_list: $ => commaSep1($._value_use_and_type),
    block_arg_list: $ => seq('(', optional($._value_use_and_type_list), ')'),
    _value_arg_list: $ => seq('(', optional(choice(
      $._value_use_type_list, // bulk: (%v0, %v1 : t0, t1)
      $._value_use_and_type_list, // per-pair: (%v0 : t0, %v1 : t1)
    )), ')'),
    _value_use_type_list: $ => seq($._value_use_list, ':', $._type_list_no_parens),

    region: $ => prec(1, seq('{', optional($.entry_block), repeat($.block), '}')),
    entry_block: $ => repeat1($.operation),

    // =========================================================================
    // Types
    // =========================================================================
    type: $ => choice($.type_alias, $.dialect_type, $.builtin_type),
    _type_list_no_parens: $ => prec.left(commaSep1(choice($.type, $.function_type))),
    // Prefer `function_type` over `_multi_dim_affine_expr_parens` on `() -> ()`.
    _type_list_parens: $ => prec(1, seq('(', optional($._type_list_no_parens), ')')),
    function_type: $ => seq(choice($.type, $._type_list_parens), $._function_return),
    _function_return: $ => seq(token('->'), choice($.type, $._type_list_parens)),
    _type_annotation: $ => seq(':', $._type_list_no_parens),
    _function_type_annotation: $ => seq(':', $.function_type),
    _literal_and_type: $ => seq($._literal, optional($._type_annotation)),

    // Type aliases
    type_alias_def: $ => seq(choice(alias($._type_alias_sigil, '!'), '!'), $._alias_or_dialect_id, '=', $.type),
    type_alias: $ => seq('!', $._alias_or_dialect_id),

    // Dialect types & pretty dialect bodies
    dialect_type: $ => seq('!', choice($.opaque_dialect_item, $.pretty_dialect_item, $.parametric_dialect_item)),
    dialect_namespace: $ => $._alias_or_dialect_id,
    dialect_ident: $ => token(seq(/[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$.-]/))),
    opaque_dialect_item: $ => prec(1, seq($.dialect_namespace, token.immediate('<'), $.string_literal, '>')),
    pretty_dialect_item: $ => seq(
      $.dialect_namespace, '.', $.dialect_ident,
      optional(alias($._attached_dialect_item_body, $.pretty_dialect_item_body)),
    ),
    parametric_dialect_item: $ => seq(
      $.dialect_namespace, alias($._attached_dialect_item_body, $.pretty_dialect_item_body),
    ),
    // Outer `<` must touch the dialect name; nested `<...>` may follow whitespace.
    _attached_dialect_item_body: $ => seq(token.immediate('<'), repeat($._pretty_dialect_item_contents), '>'),
    // Dynamic -1 prefers builtin types and offsets `dialect_dim_list` inside nested bodies.
    pretty_dialect_item_body: $ => prec.dynamic(-1, seq('<', repeat($._pretty_dialect_item_contents), '>')),
    _pretty_dialect_item_contents: $ => choice(
      // Unassociated so `<` shifts into builtin `tensor`/`opaque` types inside tuples.
      'tensor', 'opaque',
      prec.left(choice(
        $._pretty_dialect_structural_content,
        $._pretty_dialect_value_content,
        $._pretty_dialect_keyword_content,
        $._pretty_dialect_punctuation_content,
        $._pretty_dialect_fallback,
      )),
    ),
    _pretty_dialect_structural_content: $ => choice(
      $.pretty_dialect_item_body,
      // Non-builtin `vector<...>` / `tuple<...>` fallback (`prec(1)` keeps valid builtin types).
      seq('vector', $.pretty_dialect_item_body),
      seq('tuple', $.pretty_dialect_item_body),
      $._pretty_dialect_bang_body_token,
      $._pretty_dialect_body_attribute,
    ),
    _pretty_dialect_value_content: $ => choice($.dialect_dim_list, $.type, prec(2, $.attribute), $._literal),
    _pretty_dialect_keyword_content: $ => choice(
      $._dense_keyword, $._sparse_keyword, 'array', 'vector', 'memref', 'tuple', $.bare_id,
    ),
    _pretty_dialect_punctuation_content: $ => choice(
      ',', ':', '=', '->',
      // Low prec lets namespace `.` win while preserving standalone `.` / `...`.
      token(prec(-1, '.')),
      '(', ')', '[', ']', '{', '}', '*', '?', '@', '#',
    ),
    _pretty_dialect_bang_body_token: $ => token(prec(1, seq('!', /[^a-zA-Z_<>]/))),
    _pretty_dialect_body_attribute: $ => choice(
      alias($._pretty_dialect_attribute_token, $.dialect_attribute),
      alias($._pretty_attribute_alias_token, $.attribute_alias),
    ),
    _pretty_attribute_alias_token: $ => token(prec(2, seq('#', /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$]/)))),
    _pretty_dialect_attribute_token: $ => token(prec(2, seq(
      '#', /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$]/), '.', /[a-zA-Z_]/, repeat(/[a-zA-Z0-9_$.-]/),
    ))),

    dimension_separator: $ => token(prec(10, 'x')),
    // Require a leading dimension before each `x` (avoids matching `input x` or `i8x16`).
    dialect_dim_list: $ => prec.dynamic(1, seq(
      repeat1(seq($._dialect_dimension, $.dimension_separator)),
      $._dialect_dim_primitive,
    )),
    _dialect_dimension: $ => choice(alias($.integer_literal, $.dimension_size), '?', '*'),
    _dialect_dim_primitive: $ => choice(prec(1, $.type), prec(1, $._pretty_dialect_body_type), $._dialect_dimension),
    _pretty_dialect_body_type: $ => choice(
      // Bare (`array<3 x ptr>`) or parameterized (`array<3 x ptr<4>>`) dialect-local types.
      prec.right(seq(choice($.bare_id, 'array', 'vector', 'tuple'), optional($.pretty_dialect_item_body))),
      'memref',
    ),

    // Builtin types
    builtin_type: $ => choice(
      $.integer_type, $.float_type, $.complex_type, $.index_type,
      $.memref_type, $.none_type, $.token_type, $.tensor_type,
      $.vector_type, $.tuple_type, $.opaque_type,
    ),
    integer_type: $ => token(prec(5, seq(choice('si', 'ui', 'i'), /[0-9]/, repeat(/[0-9]/)))),
    float_type: $ => token(prec(5, choice(
      'f16', 'tf32', 'f32', 'f64', 'f80', 'f128', 'bf16',
      'f4E2M1FN', 'f6E2M3FN', 'f6E3M2FN',
      'f8E3M4', 'f8E4M3', 'f8E4M3FN', 'f8E4M3FNUZ', 'f8E4M3B11FNUZ',
      'f8E5M2', 'f8E5M2FNUZ', 'f8E5M3FNU', 'f8E8M0FNU',
    ))),
    index_type: $ => token(prec(5, 'index')),
    none_type: $ => token(prec(5, 'none')),
    token_type: $ => token(prec(5, 'token')),
    complex_type: $ => seq($._complex_type_start, $._prim_type, '>'),
    // Beats `seq('vector' | 'tuple', body)` fallback on valid builtin types.
    _prim_type: $ => prec(1, choice(
      $.integer_type, $.float_type, $.index_type, $.complex_type,
      $.none_type, $.token_type, $.memref_type, $.vector_type,
      $.tensor_type, $.tuple_type, $.opaque_type, $.dialect_type, $.type_alias,
    )),

    memref_type: $ => prec(1, seq(
      token('memref'), '<',
      field('dimension_list', $.dim_list),
      optional(seq(',', $.attribute_value)),
      optional(seq(',', $.attribute_value)),
      '>',
    )),
    dim_list: $ => seq($._dim_primitive, repeat(seq('x', $._dim_primitive))),
    // `prec(1)` beats `integer_literal` inside `pretty_dialect_item_body`.
    dimension_size: $ => token(prec(1, repeat1(/[0-9]/))),
    // `*` denotes unranked memref/tensor; vector disallows `*` via `vector_dim_list`.
    _dim_primitive: $ => choice(prec(1, $.type), $.dimension_size, '?', '*'),

    tensor_type: $ => seq(token('tensor'), '<', $.dim_list, optional(seq(',', $.tensor_encoding)), '>'),
    tensor_encoding: $ => $.attribute_value,

    vector_type: $ => prec(1, seq(token('vector'), '<', optional($.vector_dim_list), $._prim_type, '>')),
    vector_dim_list: $ => seq($._vector_dimension, repeat(seq('x', $._vector_dimension)), 'x'),
    _vector_dimension: $ => choice($.dimension_size, seq('[', $.dimension_size, ']')),

    tuple_type: $ => prec(1, seq(token('tuple'), '<', commaSep($.tuple_dim), '>')),
    tuple_dim: $ => choice($._prim_type, $.function_type),

    opaque_type: $ => seq(token('opaque'), '<', $.string_literal, ',', $.string_literal, '>'),

    // =========================================================================
    // Attributes
    // =========================================================================
    attribute_entry: $ => choice(
      seq(field('key', choice($.bare_id, $.string_literal)), optional(seq('=', field('value', $.attribute_value)))),
      $.array_attribute, // e.g. `{["op.name"]}` (transform dialect)
    ),
    attribute_value: $ => choice($.array_attribute, $._attribute_value_nobracket),
    array_attribute: $ => seq(
      '[', optional($._attribute_array_element), repeat(seq(',', $._attribute_array_element)), ']',
    ),
    _attribute_array_element: $ => choice($.array_attribute, $._attribute_value_nobracket),
    _attribute_value_nobracket: $ => choice(
      $.attribute_alias, $.dialect_attribute, $.builtin_attribute, $.dictionary_attribute,
      $._literal_and_type, $.type, $.function_type, $.affine_map_inline,
      $.symbol_ref_id, $.trailing_location,
      seq(choice($.attribute_alias, $.dialect_attribute, $.builtin_attribute), $._type_annotation),
    ),
    attribute: $ => choice($.attribute_alias, $.dialect_attribute, $.builtin_attribute, $.dictionary_attribute),

    // Attribute aliases
    attribute_alias_def: $ => seq(
      choice(alias($._attribute_alias_sigil, '#'), '#'), $._alias_or_dialect_id, '=', $.attribute_value,
    ),
    attribute_alias: $ => seq('#', $._alias_or_dialect_id),

    // Dialect attributes
    dialect_attribute: $ => seq('#', choice($.opaque_dialect_item, $.pretty_dialect_item, $.parametric_dialect_item)),

    // Builtin attributes
    builtin_attribute: $ => choice(
      $.strided_layout,
      prec(1, $.affine_map),
      prec(1, $.affine_set),
      $.dense_resource_literal,
      $.distinct_attribute,
    ),
    dense_resource_literal: $ => seq(token(prec(2, 'dense_resource')), '<', choice($.bare_id, $.string_literal), '>'),
    distinct_attribute: $ => seq(
      token('distinct'), '[', alias($._unsigned_integer_literal, $.integer_literal), ']',
      '<', optional($.attribute_value), '>',
    ),
    strided_layout: $ => seq(
      token('strided'), '<', '[', optional($._stride_list_comma), ']',
      optional(seq(',', token('offset'), ':', $._stride_primitive)), '>',
    ),
    _stride_list_comma: $ => commaSep1($._stride_primitive),
    _stride_primitive: $ => choice($.integer_literal, '?', '*'),

    // =========================================================================
    // Affine expressions
    // =========================================================================
    affine_map: $ => seq(
      token('affine_map'), '<',
      $._multi_dim_affine_expr_parens, optional($._multi_dim_affine_expr_sq),
      token('->'), $._multi_dim_affine_expr_parens, '>',
    ),
    affine_map_inline: $ => seq(
      $._multi_dim_affine_expr_parens, optional($._multi_dim_affine_expr_sq),
      token('->'), $._multi_dim_affine_expr_parens,
    ),
    affine_set: $ => seq(
      token('affine_set'), '<',
      $._multi_dim_affine_expr_parens, optional($._multi_dim_affine_expr_sq),
      ':', $._multi_dim_affine_expr_parens, '>',
    ),
    _multi_dim_affine_expr_parens: $ => seq('(', optional($._multi_dim_affine_expr), ')'),
    _multi_dim_affine_expr_sq: $ => seq('[', optional($._multi_dim_affine_expr), ']'),
    _multi_dim_affine_expr: $ => commaSep1($._affine_expr),
    _affine_expr: $ => choice(
      seq('(', $._affine_expr, ')'),
      prec(4, seq('-', $._affine_expr)),
      prec.left(3, seq($._affine_expr, choice('*', 'ceildiv', 'floordiv', 'mod'), $._affine_expr)),
      prec.left(2, seq($._affine_expr, choice('+', '-'), $._affine_expr)),
      prec.left(1, seq($._affine_expr, choice('==', '>=', '<='), $._affine_expr)),
      $._affine_prim,
    ),
    _affine_prim: $ => choice(
      $.integer_literal,
      $.value_use,
      seq(
        choice($.bare_id, $._dense_keyword, $._sparse_keyword),
        optional(seq(':', choice(
          $.bare_id, $._dense_keyword, $._sparse_keyword,
          'compressed', 'singleton', 'loose_compressed', 'n_out_of_m',
        ))),
      ),
      seq('symbol', '(', $.value_use, ')'),
      seq(choice('max', 'min'), '(', $._value_use_list, ')'),
    ),

    // =========================================================================
    // Function signatures (Tier-1 func_operation)
    // =========================================================================
    func_return: $ => seq(token('->'), $.type_list_attr_parens),
    func_arg_list: $ => seq('(', optional(choice($.variadic, $._value_id_and_type_attr_list)), ')'),
    _value_id_and_type_attr_list: $ => seq(
      $._value_id_and_type_attr,
      repeat(seq(',', choice($._value_id_and_type_attr, $.variadic))),
    ),
    _value_id_and_type_attr: $ => seq($._function_arg, optional($.attribute), optional($.trailing_location)),
    _function_arg: $ => choice(
      seq($.value_use, ':', choice($.type, $.function_type)),
      $.value_use, $.type, $.function_type,
    ),
    _type_or_func_type: $ => choice($.type, $.function_type),
    type_list_attr_parens: $ => choice(
      $.type,
      $.function_type,
      seq(
        '(', $._type_or_func_type, optional($.attribute),
        repeat(seq(',', $._type_or_func_type, optional($.attribute))), ')',
      ),
      seq('(', ')'),
    ),
    variadic: $ => token('...'),

    // =========================================================================
    // Shared helpers & low-level tokens
    // =========================================================================
    _value_use_list_parens: $ => seq('(', optional($._value_use_list), ')'),
    comment: $ => token(seq('//', /.*/)),
    _dense_keyword: $ => token(prec(1, 'dense')),
    _sparse_keyword: $ => token(prec(1, 'sparse')),
    _complex_type_start: $ => token(prec(1, /complex</)),
  },
});
