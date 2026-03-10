'use strict';

module.exports = {
  bufferization_dialect: $ => prec.right(choice(
    seq('bufferization.clone',
      field('input', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    seq('bufferization.dealloc',
      field('memrefs_if', optional(seq('(', $._value_use_type_list, ')',
        token('if'), '(', $._value_use_list, ')'))),
      field('retain', optional(seq(token('retain'), '(', $._value_use_type_list, ')'))),
      field('attributes', optional($.attribute))),

    seq('bufferization.dealloc_tensor',
      field('tensor', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    seq('bufferization.materialize_in_destination',
      field('source', $.value_use),
      token('in'),
      field('restrict', optional($.restrict_attr)),
      field('writable', optional($.writable_attr)),
      field('dest', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._function_type_annotation)),

    seq('bufferization.alloc_tensor',
      field('in', $._value_use_list_parens),
      field('copy', optional(seq(token('copy'), '(', $.value_use, ')'))),
      field('size_hint', optional(seq(token('size_hint'), '=', $.value_use))),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    seq('bufferization.to_buffer',
      field('tensor', $.value_use),
      field('read_only', optional($.read_only_attr)),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `bufferization.to_memref` $tensor attr-dict `:` type($memref)
    seq('bufferization.to_memref',
      field('tensor', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `bufferization.to_tensor` $memref
    //               (`restrict` $restrict^)? (`writable` $writable^)? attr-dict
    //               `:` type($memref)
    seq('bufferization.to_tensor',
      field('memref', $.value_use),
      field('restrict', optional($.restrict_attr)),
      field('writable', optional($.writable_attr)),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation))
  ))
}
