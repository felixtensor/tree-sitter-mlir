module @registered_dialects {
// <- function.builtin
//     ^ string.special.symbol
  func.func @ok0(%in: !llvm.ptr) {
//^ function.builtin
//          ^ string.special.symbol
//               ^ variable.special
//                    ^ type
    return
//  ^ function.builtin
  }

  func.func @ok2(%in: !llvm.ptr) -> !llvm.ptr {
//^ function.builtin
//          ^ string.special.symbol
//               ^ variable.special
//                    ^ type
//                                   ^ type
    return %in : !llvm.ptr
//  ^ function.builtin
//         ^ variable.special
//               ^ type
  }

  func.func @ok4() -> !llvm.ptr {
//^ function.builtin
//          ^ string.special.symbol
//                     ^ type
    %out = llvm.mlir.zero : !llvm.ptr
//  ^ variable.special
//         ^ function.builtin
//                          ^ type
    return %out : !llvm.ptr
//  ^ function.builtin
//         ^ variable.special
//                ^ type
  }
}
