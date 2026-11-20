# MLIR Examples for Parser Testing

This directory contains `.mlir` files sourced from the official
[LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test)
and selected [Flang tests](https://github.com/llvm/llvm-project/tree/main/flang/test),
used as **Tier-2** smoke tests for `tree-sitter-mlir`.

## Purpose

While `test/corpus/` verifies exact AST snapshots (`tree-sitter test`), this
directory holds real-world `.mlir` files validated with `tree-sitter parse` for
zero `ERROR` or `MISSING` nodes.

**Caveat:** `tree-sitter parse` checks only for the absence of syntax errors,
not tree correctness (for example, misparsed block labels or flattened regions).
An error-free parse here is a smoke gate, not a structural AST baseline.

## Directory Structure

```
examples/          (712 files, 216,846 lines, 44 synced directories; November 2026)
├── IR/                      ← mlir/test/IR/                               (16)
├── Builtin/                 ← mlir/test/Dialect/Builtin/                   (3)
│   └── Bytecode/            ← mlir/test/Dialect/Builtin/Bytecode/          (2)
├── Bytecode/                ← mlir/test/Bytecode/                          (1)
├── Func/                    ← mlir/test/Dialect/Func/                      (2)
├── Arith/                   ← mlir/test/Dialect/Arith/                    (29)
├── SCF/                     ← mlir/test/Dialect/SCF/                      (42)
├── ControlFlow/             ← mlir/test/Dialect/ControlFlow/               (5)
├── MemRef/                  ← mlir/test/Dialect/MemRef/                   (32)
├── Tensor/                  ← mlir/test/Dialect/Tensor/                   (30)
├── Affine/                  ← mlir/test/Dialect/Affine/                   (50)
│   └── SuperVectorize/      ← mlir/test/Dialect/Affine/SuperVectorize/    (16)
├── Vector/                  ← mlir/test/Dialect/Vector/                   (86)
│   ├── canonicalize/        ← mlir/test/Dialect/Vector/canonicalize/       (7)
│   ├── td/                  ← mlir/test/Dialect/Vector/td/                 (5)
│   └── CPU/
│       ├── ArmSVE/          ← mlir/test/Dialect/Vector/CPU/ArmSVE/         (5)
│       └── X86/             ← mlir/test/Dialect/Vector/CPU/X86/            (1)
├── Linalg/                  ← mlir/test/Dialect/Linalg/                  (148)
│   ├── td/                  ← mlir/test/Dialect/Linalg/td/                 (7)
│   ├── vectorization/       ← mlir/test/Dialect/Linalg/vectorization/     (14)
│   ├── elementwise/         ← mlir/test/Dialect/Linalg/elementwise/        (3)
│   └── convolution/         ← mlir/test/Dialect/Linalg/convolution/        (1)
├── OpenACC/                 ← mlir/test/Dialect/OpenACC/                 (104)
├── LLVMIR/                  ← mlir/test/Dialect/LLVMIR/                   (72)
├── LLVM/                    ← mlir/test/Dialect/LLVM/                      (4)
├── GPU/                     ← mlir/test/Dialect/GPU/                       (2)
├── OpenMP/                  ← mlir/test/Dialect/OpenMP/                    (2)
├── AMDGPU/                  ← mlir/test/Dialect/AMDGPU/                    (2)
├── NVGPU/                   ← mlir/test/Dialect/NVGPU/                     (1)
├── DLTI/                    ← mlir/test/Dialect/DLTI/                      (1)
├── MPI/                     ← mlir/test/Dialect/MPI/                       (1)
├── Shard/                   ← mlir/test/Dialect/Shard/                     (1)
├── PDL/                     ← mlir/test/Dialect/PDL/                       (2)
├── PDLInterp/               ← mlir/test/Dialect/PDLInterp/                 (1)
├── IRDL/                    ← mlir/test/Dialect/IRDL/                      (1)
├── WasmSSA/                 ← mlir/test/Dialect/WasmSSA/custom_parser/     (1)
├── Tosa/                    ← mlir/test/Dialect/Tosa/                      (1)
├── Conversion/
│   ├── FuncToLLVM/          ← mlir/test/Conversion/FuncToLLVM/             (1)
│   ├── MPIToLLVM/           ← mlir/test/Conversion/MPIToLLVM/              (1)
│   └── ShardToMPI/          ← mlir/test/Conversion/ShardToMPI/             (2)
├── Flang/Fir/CUDA/          ← flang/test/Fir/CUDA/                         (1)
├── Rewrite/                 ← mlir/test/Rewrite/                           (1)
├── Target/LLVMIR/           ← mlir/test/Target/LLVMIR/                     (2)
└── Transforms/              ← mlir/test/Transforms/                        (3)
```

Counts reflect the `.mlir` files synced from each upstream directory; upstream
subdirectories are listed on their own rows. See [SOURCE.md](./SOURCE.md) for
the current upstream commit and sync timestamp.

## Running Tests

```bash
# Parse all examples and show statistics
npm run test:examples

# Run corpus, highlight, and example tests
npm run test:all
```

## Updating Examples

Sync from a local `llvm-project` checkout (defaults to `$LLVM_PROJECT_DIR` or
`../llvm-project`):

```bash
./scripts/sync-examples.sh /path/to/llvm-project
```

The script records the source commit and timestamp in `examples/SOURCE.md` and
prunes examples removed upstream.

## File Selection Policy

- **Included:** direct-child `*.mlir` files from the configured dialect test
  directories plus `SUBDIALECTS` in `scripts/sync-examples.sh`; other dialects,
  core IR, conversion, target, rewrite, transforms, and Flang tests use curated
  file lists in `scripts/sync-examples.sh`.
- **Excluded:** files with `invalid` in the name (intentionally malformed
  diagnostic tests).
