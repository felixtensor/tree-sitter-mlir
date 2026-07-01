func.func @simple(i64, i64) -> i64 {
// <- function.builtin
//        ^ string.special.symbol
//               ^ punctuation.bracket
//                ^ type.builtin
//                   ^ punctuation.delimiter
//                     ^ type.builtin
//                        ^ punctuation.bracket
//                          ^ operator
//                             ^ type.builtin
//                                 ^ punctuation.bracket
^bb1(%d : i64, %e : i64):
// <- label
//   ^ variable.special
//        ^ type.builtin
//             ^ variable.special
//                  ^ type.builtin
  %0 = arith.addi %d, %e : i64
// ^ variable.special
//   ^ operator
//     ^ function.builtin
//                ^ variable.special
//                    ^ variable.special
//                          ^ type.builtin
  return %0 : i64   // Return is also a terminator.
// ^ function.builtin
//       ^ variable.special
//            ^ type.builtin
//                  ^ comment
}
// <- punctuation.bracket
