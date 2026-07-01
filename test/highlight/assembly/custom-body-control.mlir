wasmssa.func @func_0(%arg0 : !wasmssa<local ref to i32>) -> i32 {
// <- function.builtin
//           ^ string.special.symbol
//                    ^ variable.special
//                            ^ type
  %cond = wasmssa.local_get %arg0 : ref to i32
//^ variable.special
//        ^ function.builtin
//                           ^ variable.special
  wasmssa.if %cond : {
    %c0 = wasmssa.const 0.5 : f32
    wasmssa.block_return %c0 : f32
  } else {
    %c1 = wasmssa.const 0.25 : f32
    wasmssa.block_return %c1 : f32
  } >^bb1
//  ^ punctuation.bracket
//   ^ label
^bb1(%retVal: f32):
// <- label
  wasmssa.return %retVal : f32
//^ function.builtin
}
