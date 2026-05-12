func.func @vector_highlights(%arg0: memref<?x?xf32>, %mask: vector<4xi1>)
// <- function.builtin
//        ^ function
//                            ^ variable.parameter
//                                   ^ type.builtin
//                                                    ^ variable.parameter
//                                                           ^ type.builtin
    -> vector<[4]xf32> {
//  ^ operator
//     ^ type.builtin
//             ^ number
  %c0 = arith.constant 0 : index
  %f0 = arith.constant 0.0 : f32
// ^ variable
//       ^ function.builtin
//                      ^ number
//                            ^ type.builtin
  %splat = vector.broadcast %f0 : f32 to vector<4xf32>
// ^ variable
//         ^ function.builtin
//                          ^ variable
//                                ^ type.builtin
//                                       ^ type.builtin
  %read = vector.transfer_read %arg0[%c0, %c0], %f0, %mask
// ^ variable
//        ^ function.builtin
//                             ^ variable.parameter
//                                   ^ variable
//                                               ^ variable
      {permutation_map = affine_map<(d0, d1) -> (d0)>}
//     ^ attribute
//                       ^ attribute
      : memref<?x?xf32>, vector<4xf32>
//      ^ type.builtin
//                       ^ type.builtin
  %cast = vector.shape_cast %read : vector<4xf32> to vector<2x2xf32>
// ^ variable
//        ^ function.builtin
//                          ^ variable
//                                  ^ type.builtin
//                                                    ^ type.builtin
  %broadcast = vector.broadcast %f0 : f32 to vector<[4]xf32>
// ^ variable
//             ^ function.builtin
//                              ^ variable
//                                    ^ type.builtin
//                                           ^ type.builtin
  return %broadcast : vector<[4]xf32>
// ^ function.builtin
//       ^ variable
//                    ^ type.builtin
}
