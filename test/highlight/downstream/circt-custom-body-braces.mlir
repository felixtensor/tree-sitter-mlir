// CIRCT syntax (Debug and Moore dialects), verified with circt-opt.
hw.module @Struct(in %a : i32, in %b : index) {
  %0 = dbg.struct {"a": %a, "b": %b} : i32, index
//                 ^ string
//                      ^ variable.special
  dbg.variable "s", %0 : !dbg.struct
//^ function.builtin
}
hw.module @After() {
// <- function.builtin
}
moore.module @Packed(in %c : !moore.l32) {
  %0 = moore.sbv_to_packed %c : struct<{u: l16, v: l16}>
//                                     ^ punctuation.bracket
//                                      ^ keyword
  moore.output
//^ function.builtin
}
