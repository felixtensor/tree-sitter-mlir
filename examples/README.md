# MLIR Examples for Parser Testing

This directory contains `.mlir` files sourced from the official
[LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test)
and selected [Flang tests](https://github.com/llvm/llvm-project/tree/main/flang/test)
and is used as **Tier-2** testing for the tree-sitter-mlir grammar.

## Purpose

While `test/corpus/` contains hand-written tests with exact AST snapshot
verification (`tree-sitter test`), this directory holds **real-world MLIR files**
that are validated using `tree-sitter parse` — the parser must produce a
complete parse tree with **no ERROR or MISSING nodes**.

**Important caveat:** `tree-sitter parse` checks only for the absence of
`ERROR` or `MISSING` nodes, not for the *correctness* of the parse tree. A tree can be
structurally wrong (misparsed block labels, flattened regions) yet still
parse without error. Example-only "green" should be understood as "no
syntax rejections," not "verified correct."

This two-tier approach follows the convention established by
[tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust) and other
official tree-sitter grammars.

## Directory Structure

```
examples/          (700 files, 214,939 lines, 37 synced directories; November 2026)
├── IR/                  ← mlir/test/IR/                               (15)
├── Builtin/             ← mlir/test/Dialect/Builtin/                   (3)
│   └── Bytecode/        ← mlir/test/Dialect/Builtin/Bytecode/          (2)
├── Func/                ← mlir/test/Dialect/Func/                      (2)
├── Arith/               ← mlir/test/Dialect/Arith/                    (29)
├── SCF/                 ← mlir/test/Dialect/SCF/                      (42)
├── ControlFlow/         ← mlir/test/Dialect/ControlFlow/               (5)
├── MemRef/              ← mlir/test/Dialect/MemRef/                   (32)
├── Tensor/              ← mlir/test/Dialect/Tensor/                   (30)
├── Affine/              ← mlir/test/Dialect/Affine/                   (50)
│   └── SuperVectorize/  ← mlir/test/Dialect/Affine/SuperVectorize/    (16)
├── Vector/              ← mlir/test/Dialect/Vector/                   (86)
│   ├── canonicalize/    ← mlir/test/Dialect/Vector/canonicalize/       (7)
│   ├── td/              ← mlir/test/Dialect/Vector/td/                 (5)
│   └── CPU/
│       ├── ArmSVE/      ← mlir/test/Dialect/Vector/CPU/ArmSVE/         (5)
│       └── X86/         ← mlir/test/Dialect/Vector/CPU/X86/            (1)
├── Linalg/              ← mlir/test/Dialect/Linalg/                  (148)
│   ├── td/              ← mlir/test/Dialect/Linalg/td/                 (7)
│   ├── vectorization/   ← mlir/test/Dialect/Linalg/vectorization/     (14)
│   ├── elementwise/     ← mlir/test/Dialect/Linalg/elementwise/        (3)
│   └── convolution/     ← mlir/test/Dialect/Linalg/convolution/        (1)
├── OpenACC/             ← mlir/test/Dialect/OpenACC/                 (104)
├── LLVMIR/              ← mlir/test/Dialect/LLVMIR/                   (72)
├── LLVM/                ← mlir/test/Dialect/LLVM/                      (4)
├── GPU/                 ← mlir/test/Dialect/GPU/                       (2)
├── OpenMP/              ← mlir/test/Dialect/OpenMP/                    (2)
├── AMDGPU/              ← mlir/test/Dialect/AMDGPU/                    (2)
├── NVGPU/               ← mlir/test/Dialect/NVGPU/                     (1)
├── PDL/                 ← mlir/test/Dialect/PDL/                       (2)
├── PDLInterp/           ← mlir/test/Dialect/PDLInterp/                 (1)
├── IRDL/                ← mlir/test/Dialect/IRDL/                      (1)
├── WasmSSA/             ← mlir/test/Dialect/WasmSSA/custom_parser/     (1)
├── Tosa/                ← mlir/test/Dialect/Tosa/                      (1)
├── Conversion/          ← mlir/test/Conversion/FuncToLLVM/             (1)
├── Flang/               ← flang/test/Fir/CUDA/                         (1)
├── Rewrite/             ← mlir/test/Rewrite/                           (1)
└── Target/              ← mlir/test/Target/LLVMIR/                     (1)
```

Counts are the `.mlir` files synced from the upstream directory named on each
row; upstream subdirectories are listed as their own rows.

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

- **Included**: Direct-child `*.mlir` files from the configured dialect test
  directories, plus the dialect subdirectories enumerated by `SUBDIALECTS` in
  `scripts/sync-examples.sh` (for example `Affine/SuperVectorize`,
  `Vector/CPU/*`, `Linalg/vectorization`). Other dialects, core IR, conversion,
  target, rewrite, and Flang tests use curated file lists
  (see `scripts/sync-examples.sh` for the current selection).
- **Excluded**: Files with `invalid` in the name (these contain intentionally
  broken syntax for MLIR diagnostic testing).
