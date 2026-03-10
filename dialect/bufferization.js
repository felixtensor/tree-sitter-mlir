'use strict';

module.exports = {
  bufferization_dialect: $ => prec.right(choice(
    // operation ::= `bufferization.clone` $input attr-dict
    //               `:` type($input) `to` type($output)
    seq('bufferization.clone',
      field('input', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `bufferization.dealloc`
    //               (`(` $memrefs^ `:` type($memrefs) `)` `if` `(` $conditions `)` )?
    //               (`retain` `(` $retained^ `:` type($retained) `)`)? attr-dict
    seq('bufferization.dealloc',
      field('memrefs_if', optional(seq('(', $._value_use_type_list, ')',
        token('if'), '(', $._value_use_list, ')'))),
      field('retain', optional(seq(token('retain'), '(', $._value_use_type_list, ')'))),
      field('attributes', optional($.attribute))),

    // operation ::= `bufferization.dealloc_tensor` $tensor attr-dict `:` type($tensor)
    seq('bufferization.dealloc_tensor',
      field('tensor', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `bufferization.materialize_in_destination` $source `in`
    //               (`restrict` $restrict^)? (`writable` $writable^)? $dest
    //               attr-dict `:` functional-type(operands, results)
    seq('bufferization.materialize_in_destination',
      field('source', $.value_use),
      token('in'),
      field('restrict', optional($.restrict_attr)),
      field('writable', optional($.writable_attr)),
      field('dest', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._function_type_annotation)),

    // operation ::= `bufferization.alloc_tensor` `(` $dynamic_sizes `)`
    //               (`copy` `(` $copy `)`)? (`size_hint` `=` $size_hint)?
    //               attr-dict `:` type($result)
    seq('bufferization.alloc_tensor',
      field('in', $._value_use_list_parens),
      field('copy', optional(seq(token('copy'), '(', $.value_use, ')'))),
      field('size_hint', optional(seq(token('size_hint'), '=', $.value_use))),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `bufferization.to_buffer` $tensor (`read_only` $read_only^)? attr-dict
    //               `:` type($tensor) `to` type($buffer)
    seq('bufferization.to_buffer',
      field('tensor', $.value_use),
      field('read_only', optional($.read_only_attr)),
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
