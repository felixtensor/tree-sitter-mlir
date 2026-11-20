#map0 = affine_map<(d0, d1) -> (d0, d1)>
// <- attribute
//      ^ constructor.builtin

#map1 = (d0, d1)[s0] -> (d0 + s0 * 2)
// <- attribute
//       ^ variable.parameter
//               ^ variable.parameter
//                          ^ operator
//                               ^ operator

#set0 = affine_set<(d0)[s0] : (d0 - s0 mod 4 == 0)>
// <- attribute
//      ^ constructor.builtin

func.func @attrs(%arg0: memref<16xf32, strided<[1], offset: 0>>,
//                                ^ type.builtin
//                                       ^ constructor.builtin
//                                                    ^ keyword
                 %arg1: memref<4x4xf32, (d0, d1) -> (d0 * 4 + d1)>) {
//                                       ^ variable.parameter
//                                                      ^ operator
//                                                          ^ operator
  "test.op"() {tag = distinct[0]<42 : i32>, "quoted.key" = ["val"]} : () -> ()
//               ^ attribute
//                       ^ constructor.builtin
//                               ^ number
//                                           ^ attribute
//                                                          ^ string
  %matched = transform.structured.match ops{["affine.for"]} in %arg0 : (!transform.any_op) -> !transform.any_op
//                                           ^ string
}
