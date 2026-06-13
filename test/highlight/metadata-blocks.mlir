"test.with_props"() <{value = 3 : i32, nested = {label = "x"}, flag}> : () -> ()
//                   ^ punctuation.bracket
//                     ^ attribute
//                                  ^ type.builtin
//                                       ^ attribute
//                                                 ^ attribute
//                                                               ^ attribute

module attributes {"test.name" = "Normal function call"} {
//                ^ punctuation.bracket
//                 ^ attribute
//                               ^ string
}
// <- punctuation.bracket

{-# dense_resource_test_2xi32: "0x400000000100000002000000" #-}
// <- punctuation.bracket
//                              ^ string
//                                                           ^ punctuation.bracket
