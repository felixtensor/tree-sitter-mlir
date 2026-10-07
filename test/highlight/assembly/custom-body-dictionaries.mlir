func.func @custom_body_dictionaries(%m: memref<4xi32>, %v: i32, %i: index,
                                    %a: memref<4xf32>, %b: memref<4xf32>,
                                    %c: memref<4xf32>) {
  %0 = memref.atomic_rmw addi %v, %m[%i] {allocation.offset = 0 : i32} : (i32, memref<4xi32>) -> i32
//     ^ function.builtin
//                                        ^ attribute
  scf.forall (%t) in (4) {
  } {acc.par_dims = #acc<par_dims[thread_x]>}
//   ^ attribute
  linalg.map { arith.addf } ins(%a, %b : memref<4xf32>, memref<4xf32>) outs(%c : memref<4xf32>)
//^ function.builtin
//             ^ function.builtin
  return
}
llvm.func @testfn(!llvm.array<2 x f32> {llvm.alignstack = 8 : i64})
llvm.func @call_with_arg_attrs(%arg0: !llvm.array<2 x f32>) {
  llvm.call @testfn(%arg0) : (!llvm.array<2 x f32> {llvm.alignstack = 8 : i64}) -> ()
//^ function.builtin
//                                                  ^ attribute
  llvm.return
}
