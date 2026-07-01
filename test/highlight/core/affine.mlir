#map0 = affine_map<(d0, d1)[s0] -> (d0 + s0, d1 floordiv 4)>
// <- attribute
//      ^ keyword
//                                     ^ operator
//                                                 ^ operator
#set0 = affine_set<(d0)[s0] : (d0 >= 0, d0 - s0 mod 4 == 0)>
// <- attribute
//      ^ keyword
//                                ^ operator
//                                         ^ operator
//                                              ^ operator
//                                                    ^ operator
func.func @affine_highlights(%n : index, %A : memref<?xf32>) {
// <- function.builtin
//        ^ string.special.symbol
//                           ^ variable.special
//                                ^ type.builtin
//                                        ^ variable.special
//                                             ^ type.builtin
  affine.for %i = 0 to %n step 4 {
// ^ function.builtin
//            ^ variable.special
//                      ^ variable.special
    %bound = affine.min #map0(%i, %i)[%n]
//  ^ variable.special
//           ^ function.builtin
//                      ^ attribute
//                            ^ variable.special
    affine.if #set0(%i)[%n] {
//   ^ function.builtin
//             ^ attribute
      %v = affine.load %A[%i] : memref<?xf32>
//    ^ variable.special
//         ^ function.builtin
//                     ^ variable.special
//                        ^ variable.special
//                              ^ type.builtin
      affine.store %v, %A[%i] : memref<?xf32>
//    ^ function.builtin
//                 ^ variable.special
//                     ^ variable.special
    }
  }
  return
// ^ function.builtin
}
