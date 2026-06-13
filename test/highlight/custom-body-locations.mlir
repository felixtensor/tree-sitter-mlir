func.func @custom_body_locations(%root: !pdl.operation) {
  pdl_interp.record_match @rewriters::@success(%root : !pdl.operation)
      : benefit(1), loc([%root]) -> ^end
//                  ^ keyword
//                       ^ variable.parameter
//                                  ^ tag

^end:
// <- tag
  return
//^ function.builtin
}
