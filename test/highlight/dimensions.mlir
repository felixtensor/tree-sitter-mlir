func.func @dims(%arg0: tensor<?x*xf32>,
//                            ^ punctuation.special
//                              ^ punctuation.special
                %arg1: memref<4x?xf32, strided<[?, *], offset: ?>>) {
//                              ^ punctuation.special
//                                              ^ punctuation.special
//                                                 ^ punctuation.special
//                                                             ^ punctuation.special
  "tt.use"() : () -> !ttg.memdesc<128x?x*xf32, #shared>
//                                    ^ punctuation.special
//                                      ^ punctuation.special
}
