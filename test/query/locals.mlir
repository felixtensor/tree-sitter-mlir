// Covers every capture pattern in queries/locals.scm using MLIR forms already
// present in examples/IR, examples/SCF, and the attribute corpus.
!i32_type_alias = i32
#map0 = affine_map<() -> ()>
#attrs = {
  maps = [#map0],
  tag = "locals"
}

module @locals {
  func.func private @callee(%i: !i32_type_alias)

  func.func @entry(%arg0: !i32_type_alias, %arg1: !i32_type_alias)
      -> !i32_type_alias {
    %sum = arith.addi %arg0, %arg1 : i32
    func.call @callee(%sum) : (i32) -> ()
    "test.region"() ({
    ^bb0(%lhs: i32, %rhs: i32, %out: i32):
      %inner = arith.addi %lhs, %rhs : i32
      "test.yield"(%inner) : (i32) -> ()
    }) {attrs = #attrs, map = #map0} : () -> ()
    return %sum : !i32_type_alias
  }
}
