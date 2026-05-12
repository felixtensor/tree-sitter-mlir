tt.func @triton_types(
// <- function.builtin
//      ^ string.special.symbol
  %arg0: !ttg.memdesc<128x256xf8E5M2, #shared, #ttg.shared_memory, mutable>,
//^ variable
//       ^ type
//                    ^ number
//                       ^ punctuation.delimiter
//                           ^ punctuation.delimiter
//                            ^ type.builtin
//                                    ^ attribute
//                                             ^ attribute
  %arg1: !tt.tensordesc<256x64xf16, #shared>,
//^ variable
//       ^ type
//                      ^ number
//                         ^ punctuation.delimiter
//                             ^ type.builtin
//                                  ^ attribute
  %arg2: !ttg.memdesc<64x32xf16, #shared, #smem, mutable, 64x128>) {
//^ variable
//       ^ type
//                    ^ number
//                      ^ punctuation.delimiter
//                         ^ punctuation.delimiter
//                          ^ type.builtin
//                               ^ attribute
//                                        ^ attribute
//                                                        ^ number
//                                                          ^ punctuation.delimiter
  tt.return
//^ function.builtin
}
