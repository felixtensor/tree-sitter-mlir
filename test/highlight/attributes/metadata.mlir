"test.with_props"() <{value = 3 : i32, nested = {label = "x"}, flag}> : () -> ()
//                   ^ punctuation.bracket
//                     ^ attribute
//                                  ^ type.builtin
//                                       ^ attribute
//                                                 ^ attribute
//                                                               ^ attribute

module attributes {test.blob_ref = #test.e1di64_elements<blob1> : tensor<*xi1>} {}
//                ^ punctuation.bracket
//                 ^ attribute
//                                      ^ attribute

{-#
  dialect_resources: {
    test: {
      blob1: "0x08000000010000000000000002000000000000000300000000000000"
    }
  },
  external_resources: {
    external: {
      blob: "0x08000000010000000000000002000000000000000300000000000000",
      bool: true,
      string: "string"
    }
  }
#-}
// <- punctuation.bracket
