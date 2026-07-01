func.func @token_highlights(%arg0: token) -> token {
// <- function.builtin
//        ^ string.special.symbol
//                             ^ variable.special
//                                    ^ type.builtin
//                                              ^ type.builtin
  %t = "test.token.produce"() : () -> token
// ^ variable.special
//     ^ function.builtin
//                                    ^ type.builtin
  return %t : token
// ^ function.builtin
//       ^ variable.special
//            ^ type.builtin
}
