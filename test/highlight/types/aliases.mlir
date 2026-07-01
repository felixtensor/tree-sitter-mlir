!pair = !llvm.struct<(i32, f32)>
// <- type
//      ^ type
!ptr = !llvm.ptr
// <- type
//     ^ type
!rec = !llvm.struct<(i32, !ptr)>
// <- type
//     ^ type
llvm.func @aliases() {
// <- function.builtin
//        ^ string.special.symbol
  %0 = llvm.mlir.zero : !ptr
// ^ variable.special
//     ^ function.builtin
//                      ^ type
  llvm.return
// ^ function.builtin
}
