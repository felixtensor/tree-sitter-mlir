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
//        ^ function
  %0 = llvm.mlir.zero : !ptr
// ^ variable
//     ^ function.builtin
//                      ^ type
  llvm.return
// ^ function.builtin
}
