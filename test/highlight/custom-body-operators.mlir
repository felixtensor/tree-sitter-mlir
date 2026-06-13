func.func @custom_body_operators(%a: i32, %b: i32, %c: i32, %d: i32) {
  test.operators %a + %b - %c * %d / %a & %b | ~ %c : i32
//               ^ variable.parameter
//                  ^ operator
//                    ^ variable.parameter
//                       ^ operator
//                         ^ variable.parameter
//                            ^ operator
//                              ^ variable.parameter
//                                 ^ operator
//                                      ^ operator
//                                           ^ operator
//                                             ^ operator
//                                                    ^ type.builtin
}
