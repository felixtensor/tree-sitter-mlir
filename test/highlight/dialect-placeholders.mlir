func.func @dialect_placeholders(%arg0: index) {
  test.placeholder ? %arg0 : index
//                 ^ punctuation.special
//                   ^ variable.parameter

  "test.op"() : () -> !foo.placeholder<?*> #foo.placeholder<*?>
//                       ^ type
//                                     ^ punctuation.special
//                                      ^ punctuation.special
//                                            ^ attribute
//                                                          ^ punctuation.special
//                                                           ^ punctuation.special
}
