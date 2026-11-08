module @named <sym_visibility = "private"> attributes {foo.attr = true} {}
// <- function.builtin
//     ^ string.special.symbol
//            ^ punctuation.bracket
//             ^ attribute
//                              ^ string
//                                       ^ punctuation.bracket
//                                         ^ attribute
//                                                     ^ attribute
//                                                                ^ boolean

builtin.module <{dlti = #dlti.map<"chip" = "sm_90">}> {}
// <- function.builtin
//             ^ punctuation.bracket
//               ^ attribute
//                                                 ^ punctuation.bracket

"test.generic"() <{value = 3}> : () -> ()
//               ^ punctuation.bracket
//                 ^ attribute
//                          ^ punctuation.bracket
