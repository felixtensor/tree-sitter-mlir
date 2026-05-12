func.func @tensor_highlights(%t: tensor<8x16x4xf32>, %idx : index)
// <- function.builtin
//        ^ function
//                            ^ variable.parameter
//                                ^ type.builtin
//                                       ^ punctuation.delimiter
//                                                     ^ variable.parameter
//                                                            ^ type.builtin
    -> tensor<?x?x?xf32> {
//  ^ operator
//     ^ type.builtin
  %c0 = arith.constant 0 : index
// ^ variable
//       ^ function.builtin
//                     ^ number
//                          ^ type.builtin
  %c1 = arith.constant 1 : index
  %slice = tensor.extract_slice %t[%c0, %c0, %c0][%idx, %idx, %idx][%c1, %c1, %c1]
// ^ variable
//         ^ function.builtin
//                              ^ variable.parameter
//                                 ^ variable
//                                                  ^ variable.parameter
      : tensor<8x16x4xf32> to tensor<?x?x?xf32>
//      ^ type.builtin
//                                 ^ type.builtin
  %pad = tensor.pad %slice low[%c0, %c0, %c0] high[%c1, %c1, %c1] {
// ^ variable
//       ^ function.builtin
//                  ^ variable
//                         ^ keyword
//                                              ^ keyword
  ^bb0(%i: index, %j: index, %k: index):
//   ^ label
    %zero = arith.constant 0.0 : f32
//  ^ variable
//          ^ function.builtin
//                         ^ number
    tensor.yield %zero : f32
//  ^ function.builtin
//               ^ variable
  } : tensor<?x?x?xf32> to tensor<?x?x?xf32>
//    ^ type.builtin
//                           ^ type.builtin
  return %pad : tensor<?x?x?xf32>
// ^ function.builtin
//       ^ variable
//              ^ type.builtin
}
