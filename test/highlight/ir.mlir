func.func @ir_highlights() {
// <- function.builtin
//        ^ function
  %c0 = "arith.constant"() {value = 1 : i32} : () -> i32 loc("source.mlir":12:3)
// ^ variable
//      ^ function.builtin
//                          ^ attribute
//                                                     ^ type.builtin
//                                                       ^ keyword
//                                                               ^ string
  "cf.br"(%c0)[^bb1] : (i32) -> ()
//^ function.builtin
//        ^ variable
//             ^ tag
//                       ^ type.builtin
^bb1(%arg0: i32):
// <- tag
//   ^ variable.parameter
//          ^ type.builtin
  "func.return"() : () -> ()
//^ function.builtin
}
