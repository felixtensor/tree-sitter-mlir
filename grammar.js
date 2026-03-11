/**
 * @file MLIR grammar for tree-sitter
 * @author Buyun Xu <xubuyun@outlook.com>
 * @license Apache-2.0 WITH LLVM-exception
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "mlir",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
