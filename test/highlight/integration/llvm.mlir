module @registered_dialects {
// <- function.builtin
//     ^ function
  func.func @ok0(%in: !llvm.ptr) {
//^ function.builtin
//          ^ function
//               ^ variable.parameter
//                    ^ type
    return
//  ^ function.builtin
  }

  func.func @ok2(%in: !llvm.ptr) -> !llvm.ptr {
//^ function.builtin
//          ^ function
//               ^ variable.parameter
//                    ^ type
//                                   ^ type
    return %in : !llvm.ptr
//  ^ function.builtin
//         ^ variable.parameter
//               ^ type
  }

  func.func @ok4() -> !llvm.ptr {
//^ function.builtin
//          ^ function
//                     ^ type
    %out = llvm.mlir.zero : !llvm.ptr
//  ^ variable
//         ^ function.builtin
//                          ^ type
    return %out : !llvm.ptr
//  ^ function.builtin
//         ^ variable
//                ^ type
  }
}
