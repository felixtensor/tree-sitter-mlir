func.func @pretty_dialect_keywords() {
  "test.op"() : () -> !foo.array<array<i32>>
//                       ^ type
//                                  ^ keyword
//                                       ^ type.builtin

  "test.op"() : () -> !foo.opaque<opaque<"payload">>
//                       ^ type
//                                   ^ keyword
//                                          ^ string

  "test.op"() {dense_attr = #foo.dense<dense<[1.0]>>} : () -> ()
//                         ^ attribute
//                                     ^ keyword
//                                            ^ number

  "test.op"() {sparse_attr = #foo.sparse<sparse<[[0]], [1.0]>>} : () -> ()
//                          ^ attribute
//                                       ^ keyword
//                                                      ^ number

  "test.op"() : () -> !foo.tensor_keyword<tensor>
//                       ^ type
//                                           ^ keyword

  "test.op"() : () -> !foo.vector_keyword<vector>
//                       ^ type
//                                           ^ keyword
}
