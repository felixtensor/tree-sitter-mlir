# MLIR Examples for Parser Testing

This directory contains `.mlir` files sourced from the official
[LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test)
and is used as **Tier-2** testing for the tree-sitter-mlir grammar.

## Purpose

While `test/corpus/` contains hand-written tests with exact AST snapshot
verification (`tree-sitter test`), this directory holds **real-world MLIR files**
that are validated using `tree-sitter parse` — the parser must produce a
complete parse tree with **no ERROR nodes**.

**Important caveat:** `tree-sitter parse` checks only for the absence of
`ERROR` nodes, not for the *correctness* of the parse tree. A tree can be
structurally wrong (misparsed block labels, flattened regions) yet still
parse without error. Example-only "green" should be understood as "no
syntax rejections," not "verified correct."

This two-tier approach follows the convention established by
[tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust) and other
official tree-sitter grammars.

## Directory Structure

```
examples/          (566 files, 176k lines, 24 dialects)
├── IR/            ← Core parser tests from mlir/test/IR/            (15)
├── Builtin/       ← mlir/test/Dialect/Builtin/                      (5)
├── Func/          ← mlir/test/Dialect/Func/                         (2)
├── Arith/         ← mlir/test/Dialect/Arith/                       (26)
├── SCF/           ← mlir/test/Dialect/SCF/                         (41)
├── ControlFlow/   ← mlir/test/Dialect/ControlFlow/                  (5)
├── MemRef/        ← mlir/test/Dialect/MemRef/                      (31)
├── Tensor/        ← mlir/test/Dialect/Tensor/                      (30)
├── Affine/        ← mlir/test/Dialect/Affine/                      (50)
├── Vector/        ← mlir/test/Dialect/Vector/                      (85)
├── Linalg/        ← mlir/test/Dialect/Linalg/                     (139)
├── OpenACC/       ← mlir/test/Dialect/OpenACC/                     (55)
├── LLVMIR/        ← mlir/test/Dialect/LLVMIR/                      (64)
├── LLVM/          ← mlir/test/Dialect/LLVM/                         (4)
├── GPU/           ← mlir/test/Dialect/GPU/                          (2)
├── OpenMP/        ← mlir/test/Dialect/OpenMP/                       (2)
├── AMDGPU/        ← mlir/test/Dialect/AMDGPU/                       (2)
├── NVGPU/         ← mlir/test/Dialect/NVGPU/                        (1)
├── PDL/           ← mlir/test/Dialect/PDL/                          (2)
├── PDLInterp/     ← mlir/test/Dialect/PDLInterp/                    (1)
├── IRDL/          ← mlir/test/Dialect/IRDL/                         (1)
├── WasmSSA/       ← mlir/test/Dialect/WasmSSA/custom_parser/        (1)
├── Rewrite/       ← mlir/test/Rewrite/                              (1)
└── Target/        ← mlir/test/Target/LLVMIR/                        (1)
```

For the current upstream anchor and sync timestamp, see
[SOURCE.md](./SOURCE.md).

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
variable. The script records the source commit and timestamp in
`examples/SOURCE.md` and prunes examples that have been removed upstream.

## File Selection Policy

- **Included**: All `*.mlir` files from each dialect's test directory.
  Select dialects with large/complex test trees use a curated file list
  (see `scripts/sync-examples.sh` for the current selection).
- **Excluded**: Files with `invalid` in the name (these contain intentionally
  broken syntax for MLIR diagnostic testing).
