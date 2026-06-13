func.func @custom_body_control(%cond: i1) {
  wasmssa.if %cond : {
    wasmssa.block_return
  } else {
    wasmssa.block_return
  } >^bb1
//  ^ punctuation.bracket
//   ^ tag

^bb1:
// <- tag
  return
//^ function.builtin
}
