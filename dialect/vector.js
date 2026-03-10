'use strict';

module.exports = {
  vector_dialect: $ => prec.right(choice(
    // operation ::= `vector.bitcast` $source attr-dict `:` type($source) `to` type($result)
    // operation ::= `vector.broadcast` $source attr-dict `:` type($source) `to` type($vector)
    // operation ::= `vector.extract_strided_slice` $vector attr-dict
    //               `:` type($vector) `to` type($result)
    // operation ::= `vector.print` $source attr-dict `:` type($source)
    // operation ::= `vector.shape_cast` $source attr-dict `:` type($source) `to` type($result)
    // operation ::= `vector.to_elements` $vector attr-dict `:` type($vector)
    // operation ::= `vector.type_cast` $memref attr-dict `:` type($memref) `to` type($result)
    seq(choice(
      'vector.bitcast',
      'vector.broadcast',
      'vector.extract_strided_slice',
      'vector.print',
      'vector.shape_cast',
      'vector.to_elements',
      'vector.type_cast'),
    field('operand', $.value_use),
    field('attributes', optional($.attribute)),
    field('return', $._type_annotation)),

    // operation ::= `vector.constant_mask` $mask_dim_sizes attr-dict `:` type($result)
    seq('vector.constant_mask',
      field('mask', $._dense_idx_list),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.create_mask` $operands attr-dict `:` type($result)
    seq('vector.create_mask',
      field('operands', $._value_use_list),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.step` attr-dict `:` type($result)
    seq('vector.step',
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.vscale` attr-dict `:` type($result)
    seq('vector.vscale',
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.from_elements` $elements attr-dict `:` type($result)
    seq('vector.from_elements',
      field('elements', $._value_use_list),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.extract` $vector `` $position attr-dict `:` type($vector)
    // operation ::= `vector.load` $base `[` $indices `]` attr-dict
    //               `:` type($base) `,` type($result)
    // operation ::= `vector.scalable.extract` $source `[` $pos `]` attr-dict
    //               `:` type($res) `from` type($source)
    seq(choice('vector.extract', 'vector.scalable.extract', 'vector.load'),
      field('operand', seq($.value_use, $._dense_idx_list)),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.insert` $source `,` $dest $position attr-dict
    //               `:` type($source) `into` type($dest)
    // operation ::= `vector.scalable.insert` $source `,` $dest `[` $pos `]` attr-dict
    //               `:` type($source) `into` type($dest)
    seq(choice('vector.insert', 'vector.scalable.insert'),
      field('source', $.value_use), ',',
      field('destination', $.value_use),
      field('position', $._dense_idx_list),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.shuffle` operands $mask attr-dict `:` type(operands)
    seq('vector.shuffle',
      field('operands', $._value_use_list),
      field('mask', $._dense_idx_list),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.store` $valueToStore `,` $base `[` $indices `]` attr-dict
    //               `:` type($base) `,` type($valueToStore)
    seq('vector.store',
      field('value', $.value_use), ',',
      field('base', seq($.value_use, $._dense_idx_list)),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.fma` $lhs `,` $rhs `,` $acc attr-dict `:` type($lhs)
    seq('vector.fma',
      field('lhs', $.value_use), ',',
      field('rhs', $.value_use), ',',
      field('acc', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.contract` attr-dict $lhs `,` $rhs `,` $acc
    //               `:` type($lhs) `,` type($rhs) `into` type($acc)
    seq('vector.contract',
      field('attributes', optional($.attribute)),
      field('lhs', $.value_use), ',',
      field('rhs', $.value_use), ',',
      field('acc', $.value_use),
      field('return', $._type_annotation)),

    // operation ::= `vector.outerproduct` $lhs `,` $rhs (`,` $acc^)? attr-dict
    //               `:` type($lhs) `,` type($rhs) `into` type($result)
    seq('vector.outerproduct',
      field('lhs', $.value_use), ',',
      field('rhs', $.value_use),
      field('acc', optional(seq(',', $.value_use))),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.expandload` $base `[` $indices `]` `,` $mask `,` $pass_thru
    //               attr-dict
    //               `:` type($base) `,` type($mask) `,` type($pass_thru) `into` type($result)
    // operation ::= `vector.maskedload` $base `[` $indices `]` `,` $mask `,` $pass_thru
    //               attr-dict
    //               `:` type($base) `,` type($mask) `,` type($pass_thru) `into` type($result)
    seq(choice('vector.expandload', 'vector.maskedload'),
      field('base', seq($.value_use, $._dense_idx_list)), ',',
      field('mask', $.value_use), ',',
      field('pass_thru', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.maskedstore` $base `[` $indices `]` `,` $mask `,` $valueToStore
    //               attr-dict
    //               `:` type($base) `,` type($mask) `,` type($valueToStore)
    // operation ::= `vector.compressstore` $base `[` $indices `]` `,` $mask `,` $valueToStore
    //               attr-dict
    //               `:` type($base) `,` type($mask) `,` type($valueToStore)
    seq(choice('vector.maskedstore', 'vector.compressstore'),
      field('base', seq($.value_use, $._dense_idx_list)), ',',
      field('mask', $.value_use), ',',
      field('value', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.gather` $base `[` $indices `]` `[` $index_vec `]` `,` $mask `,`
    //               $pass_thru attr-dict
    //               `:` type($base) `,` type($index_vec) `,` type($mask) `,` type($pass_thru)
    //               `into` type($result)
    // operation ::= `vector.scatter` $base `[` $indices `]` `[` $index_vec `]` `,` $mask `,`
    //               $valueToStore attr-dict
    //               `:` type($base) `,` type($index_vec) `,` type($mask) `,` type($valueToStore)
    seq(choice('vector.gather', 'vector.scatter'),
      field('base', seq($.value_use, $._dense_idx_list, $._dense_idx_list)), ',',
      field('mask', $.value_use), ',',
      field('value', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.deinterleave` $operands attr-dict `:` type(operands)
    // operation ::= `vector.interleave` $operands attr-dict `:` type(operands)
    seq(choice('vector.deinterleave', 'vector.interleave'),
      field('operands', $._value_use_list),
      field('attributes', optional($.attribute)),
      field('return', choice($._function_type_annotation, $._type_annotation))),

    // operation ::= `vector.insert_strided_slice` $source `,` $dest attr-dict
    //               `:` type($source) `into` type($dest)
    seq('vector.insert_strided_slice',
      field('source', $.value_use), ',',
      field('destination', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.transfer_read` $source `[` $indices `]` `,` $padding (`,` $mask^)? attr-dict
    //               `:` type($source) `,` type($result)
    seq('vector.transfer_read',
      field('source', seq($.value_use, $._dense_idx_list)), ',',
      field('padding', $.value_use),
      field('mask', optional(seq(',', $.value_use))),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.transfer_write` $vector `,` $dest `[` $indices `]` (`,` $mask^)? attr-dict
    //               `:` type($vector) `,` type($dest)
    seq('vector.transfer_write',
      field('vector', $.value_use), ',',
      field('destination', seq($.value_use, $._dense_idx_list)),
      field('mask', optional(seq(',', $.value_use))),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.transpose` $vector `,` $transp attr-dict `:` type($vector) `to` type($result)
    seq('vector.transpose',
      field('vector', $.value_use), ',',
      field('indices', $._dense_idx_list),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.reduction` $kind `,` $vector (`,` $acc^)? attr-dict `:` type($vector) `into` type($dest)
    // operation ::= `vector.multi_reduction` $kind `,` $vector (`,` $acc^)? $dims attr-dict `:` type($vector) `into` type($dest)
    // operation ::= `vector.scan` $kind `,` $vector (`,` $acc^)? $dims attr-dict `:` type($vector) `into` type($dest)
    seq(choice('vector.reduction', 'vector.multi_reduction', 'vector.scan'),
      field('kind', choice(seq('<', $.bare_id, '>'), $.dialect_attribute)), ',',
      field('vector', $.value_use),
      field('acc', optional(seq(',', $.value_use))),
      field('dims', optional($._dense_idx_list)),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // operation ::= `vector.mask` $mask $region attr-dict `:` type($mask) `->` type($result)
    seq('vector.mask',
      field('mask', $.value_use),
      field('body', $.region),
      field('attributes', optional($.attribute)),
      field('return', $._function_type_annotation)),

    // operation ::= `vector.yield` attr-dict ($operands^ `:` type($operands))?
    seq('vector.yield',
      field('attributes', optional($.attribute)),
      field('results', optional($._value_use_type_list)))
  ))
}
