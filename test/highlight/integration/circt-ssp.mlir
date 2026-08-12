ssp.instance @problem of "Problem" {
// <- function.builtin
  library {
//^ function.builtin
    operator_type @Add [latency<1>]
//  ^ function.builtin
    operator_type @Mul [latency<2>]
//  ^ function.builtin
  }
  resource {
//^ function.builtin
    resource_type @ALU [limit<1>]
//  ^ function.builtin
    resource_type @DSP [limit<2>]
//  ^ function.builtin
  }
  graph {
//^ function.builtin
    %0 = operation<@Add>()
//       ^ function.builtin
    operation<@Mul>(%0)
//  ^ function.builtin
  }
}
