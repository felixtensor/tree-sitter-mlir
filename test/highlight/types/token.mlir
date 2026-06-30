func.func @token_highlights(%arg0: token) -> token {
// <- function.builtin
//        ^ function
//                             ^ variable.parameter
//                                    ^ type.builtin
//                                              ^ type.builtin
  %t = "test.token.produce"() : () -> token
// ^ variable
//     ^ function.builtin
//                                    ^ type.builtin
  return %t : token
// ^ function.builtin
//       ^ variable
//            ^ type.builtin
}
