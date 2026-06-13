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
#levels0 = affine_map<(d0 : dense, d1 : compressed, d2 : singleton) -> (d0, d1, d2)>
// <- attribute
//         ^ keyword
//                           ^ keyword
//                                      ^ keyword
//                                                       ^ keyword
#levels1 = affine_map<(d0 : loose_compressed, d1 : n_out_of_m, d2 : sparse) -> (d0, d1, d2)>
// <- attribute
//         ^ keyword
//                           ^ keyword
//                                                 ^ keyword
//                                                                  ^ keyword

func.func @affine_highlights(%n : index, %A : memref<?xf32>) {
// <- function.builtin
//        ^ function
//                           ^ variable.parameter
//                                ^ type.builtin
//                                        ^ variable.parameter
//                                             ^ type.builtin
  affine.for %i = 0 to %n step 4 {
// ^ function.builtin
//            ^ variable
//                      ^ variable.parameter
    %bound = affine.min #map0(%i, %i)[%n]
//  ^ variable
//           ^ function.builtin
//                      ^ attribute
//                            ^ variable
    affine.if #set0(%i)[%n] {
//   ^ function.builtin
//             ^ attribute
      %v = affine.load %A[%i] : memref<?xf32>
//    ^ variable
//         ^ function.builtin
//                     ^ variable.parameter
//                        ^ variable
//                              ^ type.builtin
      affine.store %v, %A[%i] : memref<?xf32>
//    ^ function.builtin
//                 ^ variable
//                     ^ variable.parameter
    }
  }
  return
// ^ function.builtin
}
