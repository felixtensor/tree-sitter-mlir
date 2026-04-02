func.func @simple(i64, i1) -> i64 {
// <- function.builtin
//        ^ function
//               ^ punctuation.bracket
//                ^ type.builtin
//                   ^ punctuation.delimiter
//                     ^ type.builtin
//                       ^ punctuation.bracket
//                         ^ operator
//                            ^ type.builtin
//                                ^ punctuation.bracket
^bb1(%d : i64, %e : i64):
// <- label
//   ^ variable.parameter
//        ^ type.builtin
//             ^ variable.parameter
//                  ^ type.builtin
  %0 = arith.addi %d, %e : i64
// ^ variable
//   ^ operator
//     ^ function.builtin
//                ^ variable.parameter
//                    ^ variable.parameter
//                          ^ type.builtin
  return %0 : i64   // Return is also a terminator.
// ^ function.builtin
//       ^ variable
//            ^ type.builtin
//                  ^ comment
}
// <- punctuation.bracket
