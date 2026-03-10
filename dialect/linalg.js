'use strict';

module.exports = {
  linalg_dialect: $ => prec.right(choice(
    // operation ::= `linalg.abs`|`linalg.add`|... attr-dict? (ins|outs|key-value)+ (`->` type)?
    seq(choice(
      'linalg.abs',
      'linalg.add',
      'linalg.batch_matmul',
      'linalg.batch_matvec',
      'linalg.batch_mmt4d',
      'linalg.batch_reduce_matmul',
      'linalg.batch_vecmat',
      'linalg.broadcast',
      'linalg.ceil',
      'linalg.contract',
      'linalg.conv_1d',
      'linalg.conv_1d_ncw_fcw',
      'linalg.conv_1d_nwc_wcf',
      'linalg.conv_2d',
      'linalg.conv_2d_nchw_fchw',
      'linalg.conv_2d_nchw_fchw_q',
      'linalg.conv_2d_ngchw_fgchw',
      'linalg.conv_2d_ngchw_gfchw',
      'linalg.conv_2d_ngchw_gfchw_q',
      'linalg.conv_2d_nhwc_fhwc',
      'linalg.conv_2d_nhwc_fhwc_q',
      'linalg.conv_2d_nhwc_hwcf',
      'linalg.conv_2d_nhwc_hwcf_q',
      'linalg.conv_2d_nhwgc_gfhwc',
      'linalg.conv_2d_nhwgc_gfhwc_q',
      'linalg.conv_3d',
      'linalg.conv_3d_ncdhw_fcdhw',
      'linalg.conv_3d_ndhwc_dhwcf',
      'linalg.conv_3d_ndhwc_dhwcf_q',
      'linalg.copy',
      'linalg.depthwise_conv_1d_ncw_cw',
      'linalg.depthwise_conv_1d_nwc_wc',
      'linalg.depthwise_conv_1d_nwc_wcm',
      'linalg.depthwise_conv_2d_nchw_chw',
      'linalg.depthwise_conv_2d_nhwc_hwc',
      'linalg.depthwise_conv_2d_nhwc_hwc_q',
      'linalg.depthwise_conv_2d_nhwc_hwcm',
      'linalg.depthwise_conv_2d_nhwc_hwcm_q',
      'linalg.depthwise_conv_3d_ncdhw_cdhw',
      'linalg.depthwise_conv_3d_ndhwc_dhwc',
      'linalg.depthwise_conv_3d_ndhwc_dhwcm',
      'linalg.div',
      'linalg.div_unsigned',
      'linalg.dot',
      'linalg.elementwise',
      'linalg.erf',
      'linalg.exp',
      'linalg.fill',
      'linalg.fill_rng_2d',
      'linalg.floor',
      'linalg.log',
      'linalg.matmul',
      'linalg.matvec',
      'linalg.max',
      'linalg.min',
      'linalg.mmt4d',
      'linalg.mul',
      'linalg.negf',
      'linalg.pooling_nchw_max',
      'linalg.pooling_nchw_sum',
      'linalg.pooling_ncw_max',
      'linalg.pooling_ncw_sum',
      'linalg.pooling_ndhwc_max',
      'linalg.pooling_ndhwc_min',
      'linalg.pooling_ndhwc_sum',
      'linalg.pooling_nhwc_max',
      'linalg.pooling_nhwc_max_unsigned',
      'linalg.pooling_nhwc_min',
      'linalg.pooling_nhwc_min_unsigned',
      'linalg.pooling_nhwc_sum',
      'linalg.pooling_nwc_max',
      'linalg.pooling_nwc_max_unsigned',
      'linalg.pooling_nwc_min',
      'linalg.pooling_nwc_min_unsigned',
      'linalg.pooling_nwc_sum',
      'linalg.powf',
      'linalg.quantized_batch_matmul',
      'linalg.quantized_matmul',
      'linalg.reciprocal',
      'linalg.round',
      'linalg.rsqrt',
      'linalg.select',
      'linalg.sqrt',
      'linalg.square',
      'linalg.sub',
      'linalg.tanh',
      'linalg.transpose',
      'linalg.vecmat',
      'linalg.winograd_filter_transform',
      'linalg.winograd_input_transform',
      'linalg.winograd_output_transform'),
      repeat1($._ins_outs_attributes),
      field('return', optional($._function_return))),

    // operation ::= `linalg.pack` $source
    //               (`padding_value` `(` $padding_value^ `:` type($padding_value) `)`)?
    //               (`outer_dims_perm` `=` $outer_dims_perm^)?
    //               `inner_dims_pos` `=` $inner_dims_pos
    //               `inner_tiles` `=` $inner_tiles
    //               `into` $dest attr-dict? `:` type($source) `->` type($dest)
    // operation ::= `linalg.unpack` $source
    //               (`outer_dims_perm` `=` $outer_dims_perm^)?
    //               `inner_dims_pos` `=` $inner_dims_pos
    //               `inner_tiles` `=` $inner_tiles
    //               `into` $dest attr-dict? `:` type($source) `->` type($dest)
    seq(choice('linalg.pack', 'linalg.unpack'),
      field('source', $.value_use),
      field('padding_value', optional(seq(token('padding_value'),
        '(', $._value_use_and_type, ')'))),
      field('outer_dims_perm', optional(seq(token('outer_dims_perm'), '=', $._dense_idx_list))),
      field('inner_dims_pos', seq(token('inner_dims_pos'), '=', $._dense_idx_list)),
      field('inner_tiles', seq(token('inner_tiles'), '=', $._dense_idx_list)),
      token('into'),
      field('destination', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._function_type_annotation)),

    // operation ::= `linalg.softmax` attr-dict?
    //               `dimension` `(` $dimension `)`
    //               `ins` `(` $input `:` type($input) `)`
    //               `outs` `(` $output `:` type($output) `)`
    //               (`->` type($result)^)?
    seq('linalg.softmax',
      field('attributes', optional($.attribute)),
      field('dimension', seq(token('dimension'), '(', $.integer_literal, ')')),
      field('ins', $._ins),
      field('outs', $._outs),
      field('return', optional($._function_return))),

    seq('linalg.generic',
      repeat1($._ins_outs_attributes),
      field('body', $.region),
      field('return', optional($._function_return))),

    // operation ::= `linalg.index` $dim attr-dict `:` type($result)
    seq('linalg.index',
      field('dimension', $.integer_literal),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    seq(choice('linalg.map', 'linalg.reduce'),
      repeat1($._ins_outs_attributes),
      field('arguments', $.block_arg_list),
      field('body', $.region),
      field('return', optional($._function_return))),

    seq('linalg.yield',
      field('attributes', optional($.attribute)),
      field('results', optional($._value_use_type_list)))
  )),

  _ins_outs_attributes: $ => choice($._ins, $._outs, $.attribute,
    $._attribute_entry_list),
  _ins: $ => seq(token('ins'), '(', $._value_use_type_list, ')'),
  _outs: $ => seq(token('outs'), '(', $._value_use_type_list, ')'),
  _attribute_entry_list: $ => seq($.bare_attribute_entry,
    repeat(seq(',', $.bare_attribute_entry))),
  bare_attribute_entry: $ => seq($.bare_id, '=', $.attribute_value)
}
