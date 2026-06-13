#CSR = #sparse_tensor.encoding<{ map = (d0, d1) -> (d0 : dense, d1 : compressed) }>
// <- attribute
//     ^ attribute

#COO = #sparse_tensor.encoding<{
  map = (i, j) -> (i : compressed(nonunique), j : singleton(soa))
}>

func.func private @sparse_tensor_encodings(
  tensor<?x?xf32, #CSR>,
//^ type.builtin
  tensor<?x?xf32, #COO>
)

func.func private @emitc_types(
  !emitc.array<30x!emitc.opaque<"int">>,
//^ type
//             ^ number
//                 ^ type
//                                ^ string
  !emitc.opaque<"status_t">
//^ type
//              ^ string
)

func.func @emitc_attrs() {
  emitc.call_opaque "f"() {args = [#emitc.opaque<"attr">],
//^ function.builtin
//                  ^ string
//                                                ^ string
                            template_args = [!emitc<opaque<"byte">>]} : () -> ()
//                          ^ attribute
//                                           ^ type
//                                                   ^ keyword
//                                                          ^ string
  return
//^ function.builtin
}
