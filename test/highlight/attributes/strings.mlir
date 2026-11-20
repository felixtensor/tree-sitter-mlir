module attributes {test.msg = "a\nb\t\"c\"", test.bad = "x\qy"} {}
//                              ^ string.escape
//                                 ^ string.escape
//                                   ^ string.escape
//                                                        ^ error
