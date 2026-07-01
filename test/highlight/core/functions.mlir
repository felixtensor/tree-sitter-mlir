func.func @test_addi(%arg0 : i64, %arg1 : i64) -> i64 {
// <- function.builtin
//        ^ string.special.symbol
//                  ^ punctuation.bracket
//                   ^ variable.special
//                         ^ punctuation.delimiter
//                           ^ type.builtin
//                              ^ punctuation.delimiter
//                                ^ variable.special
//                                        ^ type.builtin
//                                           ^ punctuation.bracket
//                                             ^ operator
//                                                ^ type.builtin
//                                                    ^ punctuation.bracket
  %0 = arith.addi %arg0, %arg1 : i64
// ^ variable.special
//   ^ operator
//     ^ function.builtin
//                ^ variable.special
//                       ^ variable.special
//                               ^ type.builtin
  return %0 : i64
// ^ function.builtin
//       ^ variable.special
//            ^ type.builtin
}
// <- punctuation.bracket
