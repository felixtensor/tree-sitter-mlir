#map0 = affine_map<(d0, d1) -> (d0, d1)>
// <- attribute
//      ^ constructor.builtin

#set0 = affine_set<(d0)[s0] : (d0 - s0 mod 4 == 0)>
// <- attribute
//      ^ constructor.builtin

func.func @attrs(%arg0: memref<16xf32, strided<[1], offset: 0>>) {
//                                ^ type.builtin
//                                       ^ keyword
//                                                    ^ keyword
  "test.op"() {tag = distinct[0]<42 : i32>} : () -> ()
//               ^ attribute
//                       ^ keyword
//                               ^ number
}
