func.func @dims(%arg0: tensor<*xf32>,
//                            ^ punctuation.special
                %arg1: memref<4x?xf32, strided<[?, ?], offset: ?>>) {
//                              ^ punctuation.special
//                                              ^ punctuation.special
//                                                 ^ punctuation.special
//                                                             ^ punctuation.special
  return
//^ function.builtin
}
