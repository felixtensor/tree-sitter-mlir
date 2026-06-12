func.func @dense_resource() {
  %0 = arith.constant dense_resource<dense_resource_test_5xf32> : tensor<5xf32>
// ^ variable
//       ^ function.builtin
//                     ^ keyword
//                                          ^ constant.builtin
//                                                                  ^ type.builtin

  %1 = arith.constant dense_resource<"quoted_resource"> : vector<3xi32>
//                     ^ keyword
//                                    ^ string
//                                                         ^ type.builtin
}
