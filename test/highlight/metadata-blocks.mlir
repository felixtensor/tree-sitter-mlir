"test.with_props"() <{value = 3 : i32, nested = {label = "x"}, flag}> : () -> ()
//                   ^ punctuation.bracket
//                     ^ attribute
//                                  ^ type.builtin
//                                       ^ attribute
//                                                 ^ attribute
//                                                               ^ attribute

{-# dense_resource_test_2xi32: "0x400000000100000002000000" #-}
// <- punctuation.bracket
//                              ^ string
//                                                           ^ punctuation.bracket
