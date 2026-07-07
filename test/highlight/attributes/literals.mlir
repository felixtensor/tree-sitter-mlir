func.func @literal_keywords() {
  "test.op"() {dense_attr = dense<[1, 2]> : tensor<2xi32>} : () -> ()
//                         ^ attribute
//                            ^ constructor.builtin
//                                 ^ number

  "test.op"() {sparse_attr = sparse<[[0]], [1.0]> : tensor<1xf32>} : () -> ()
//                          ^ attribute
//                             ^ constructor.builtin
//                                    ^ number
//                                          ^ number

  "test.op"() {segments = array<i32: 1, 2>} : () -> ()
//               ^ attribute
//                          ^ constructor.builtin
//                                ^ type.builtin
//                                   ^ number
}
