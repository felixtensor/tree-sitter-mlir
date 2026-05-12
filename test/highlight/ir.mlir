func.func @ir_highlights() {
// <- function.builtin
//        ^ function
  %c0 = "arith.constant"() {value = 1 : i32} : () -> i32 loc("source.mlir":12:3)
// ^ variable
//      ^ string
//                          ^ attribute
//                                                     ^ type.builtin
//                                                       ^ keyword
//                                                               ^ string
  "cf.br"(%c0)[^bb1] : (i32) -> ()
//^ string
//        ^ variable
//             ^ label
//                       ^ type.builtin
^bb1(%arg0: i32):
// <- label
//   ^ variable.parameter
//          ^ type.builtin
  "func.return"() : () -> ()
//^ string
}
