# MLIR Examples for Parser Testing

This directory contains `.mlir` files sourced from the official
[LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test)
and is used as **Tier 2** testing for the tree-sitter-mlir grammar.

## Purpose

While `test/corpus/` contains hand-written tests with exact AST snapshot
verification (`tree-sitter test`), this directory holds **real-world MLIR files**
that are validated using `tree-sitter parse` — the parser must produce a
complete parse tree with **no ERROR nodes**.

This two-tier approach follows the convention established by
[tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust) and other
official tree-sitter grammars.

## Directory Structure

```
examples/
├── IR/            ← Core parser tests from mlir/test/IR/
├── Builtin/       ← mlir/test/Dialect/Builtin/
├── Func/          ← mlir/test/Dialect/Func/
├── Arith/         ← mlir/test/Dialect/Arith/
├── SCF/           ← mlir/test/Dialect/SCF/
├── ControlFlow/   ← mlir/test/Dialect/ControlFlow/
├── MemRef/        ← mlir/test/Dialect/MemRef/
├── Tensor/        ← mlir/test/Dialect/Tensor/
├── Affine/        ← mlir/test/Dialect/Affine/
├── Vector/        ← mlir/test/Dialect/Vector/
└── Linalg/        ← mlir/test/Dialect/Linalg/
```

## Running Tests

```bash
# Parse all examples and show statistics
npm run test:examples

# Run both corpus and examples tests
npm run test:all
```

## Updating Examples

To sync files from a local copy of llvm-project:

```bash
./scripts/sync-examples.sh /path/to/llvm-project
```

By default it looks for `../llvm-project` or the `LLVM_PROJECT_DIR` environment
variable.

## File Selection Policy

- **Included**: All `*.mlir` files from each dialect's test directory
- **Excluded**: Files with `invalid` in the name (these contain intentionally
  broken syntax for MLIR diagnostic testing)
