func.func private @foo() attributes {test.a} {
// <- function.builtin
//        ^ attribute
//                ^ string.special.symbol
//                       ^ attribute
  func.return
//^ function.builtin
}
module @bar attributes {test.b} {}
// <- function.builtin
//     ^ string.special.symbol
//          ^ attribute
