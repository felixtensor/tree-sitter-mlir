func.func @custom_body_operators(%a: vector<4xf16>, %b: vector<8xf16>,
                                 %c: vector<4xf32>, %idx: vector<4xi8>) {
  %0 = amdgpu.sparse_mfma 16x16x32 %a * %b + %c sparse(%idx : vector<4xi8>)
//     ^ function.builtin
//                        ^ number
//                           ^ number
//                              ^ number
//                                    ^ operator
//                                         ^ operator
//                                                ^ keyword
//                                                       ^ variable.special
    {abid = 0 : i32, cbsz = 0 : i32}
//   ^ attribute
    : vector<4xf16>, vector<8xf16>, vector<4xf32>
//    ^ type.builtin
  amdgpu.memory_counter_wait tensor(3)
//^ function.builtin
//                           ^ keyword
  test.op 8x?x4 : i32
//^ function.builtin
//        ^ number
//         ^ punctuation.delimiter
//          ^ punctuation.special
//           ^ punctuation.delimiter
//            ^ number
  return
//^ function.builtin
}
