llvm.func internal fastcc @callee() -> i32
// <- function.builtin
//        ^ keyword
//                 ^ keyword
//                        ^ function
//                                     ^ type.builtin

func.func nested @fold() -> i32
// <- function.builtin
//        ^ keyword
//               ^ function
//                          ^ type.builtin
