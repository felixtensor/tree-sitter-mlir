#loc0 = loc(unknown)
//      ^ keyword
//          ^ constant.builtin

#loc1 = loc(fused<#loc0>["callee", "source.mlir":12:3 to 14:2])
//      ^ keyword
//          ^ keyword
//                ^ attribute
//                       ^ string
//                                 ^ string
//                                               ^ number
//                                                    ^ keyword
//                                                       ^ number

"test.op"() : () -> () loc(callsite("callee" at "caller.mlir":7:9))
//                      ^ keyword
//                          ^ keyword
//                                   ^ string
//                                            ^ keyword
//                                               ^ string
//                                                            ^ number
