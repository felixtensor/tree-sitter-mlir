llvm.func internal fastcc @callee() -> i32 attributes {dso_local} {
// <- function.builtin
//        ^ keyword
//                 ^ keyword
//                        ^ string.special.symbol
//                                     ^ type.builtin
  %0 = llvm.mlir.constant(0 : i32) : i32
//^ variable.special
//     ^ function.builtin
  llvm.return %0 : i32
//^ function.builtin
}

func.func nested @fold() -> i32
// <- function.builtin
//        ^ keyword
//               ^ string.special.symbol
//                          ^ type.builtin
