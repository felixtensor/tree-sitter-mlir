func.func @custom_body_keywords(%arg0: tensor<4xf32>, %idx: index) {
  test.array array(%arg0 : tensor<4xf32>) : (tensor<4xf32>) -> ()
//           ^ keyword
//                 ^ variable.parameter
//                         ^ type.builtin

  test.sparse sparse(%idx : index) : (index) -> ()
//             ^ keyword
//                    ^ variable.parameter
//                           ^ type.builtin

  test.tensor tensor(%arg0 : tensor<4xf32>) : (tensor<4xf32>) -> ()
//             ^ keyword
//                            ^ type.builtin

  test.vector vector(%arg0 : vector<4xf32>) : (vector<4xf32>) -> ()
//             ^ keyword
//                            ^ type.builtin
}
