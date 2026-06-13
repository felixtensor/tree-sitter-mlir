func.func @memref_highlights(%src: memref<?xf32>)
// <- function.builtin
//        ^ function
//                            ^ variable.parameter
//                                  ^ type.builtin
  -> memref<10x?xf32, strided<[?, 1], offset: ?>> {
// ^ operator
//   ^ type.builtin
//                     ^ keyword
//                                      ^ keyword
  %c0 = arith.constant 0 : index
// ^ variable
//       ^ function.builtin
//                     ^ number
//                          ^ type.builtin
  %c10 = arith.constant 10 : index
// ^ variable
//        ^ function.builtin
//                       ^ number
  %view = memref.reinterpret_cast %src to
// ^ variable
//        ^ function.builtin
//                                 ^ variable.parameter
           offset: [%c0], sizes: [10, %c10], strides: [%c10, 1]
//         ^ keyword
//                  ^ variable
//                         ^ keyword
//                                      ^ variable
//                                              ^ keyword
           : memref<?xf32> to memref<10x?xf32, strided<[?, 1], offset: ?>>
//           ^ type.builtin
//                            ^ type.builtin
//                                              ^ keyword
  %v = memref.load %view[%c0, %c10]
// ^ variable
//     ^ function.builtin
//                  ^ variable
//                        ^ variable
      : memref<10x?xf32, strided<[?, 1], offset: ?>>
//      ^ type.builtin
//                        ^ keyword
  memref.store %v, %view[%c0, %c10]
//^ function.builtin
//             ^ variable
//                 ^ variable
      : memref<10x?xf32, strided<[?, 1], offset: ?>>
//      ^ type.builtin
  return %view : memref<10x?xf32, strided<[?, 1], offset: ?>>
// ^ function.builtin
//       ^ variable
//               ^ type.builtin
}
