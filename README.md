# tree-sitter-mlir

[MLIR](https://mlir.llvm.org) grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter).

## Acknowledgments

This project is based on the work of [Ramkumar Ramachandra](https://github.com/artagnon) ([artagnon/tree-sitter-mlir](https://github.com/artagnon/tree-sitter-mlir)), who created the original tree-sitter grammar for MLIR. The original project is licensed under [Apache-2.0](./LICENSE).

## Status

The parser targets [generic MLIR syntax](https://mlir.llvm.org/docs/LangRef/) rather than individual dialect-specific assembly formats. It is under active development and not yet fully complete.

### Test Coverage

We use a two-tier test architecture following [tree-sitter community conventions](https://github.com/tree-sitter/tree-sitter-rust):

| Tier | Directory | Tool | Description |
|------|-----------|------|-------------|
| **1** | `test/corpus/` | `tree-sitter test` | Hand-written tests with exact AST snapshot matching |
| **2** | `examples/` | `tree-sitter parse` | Official MLIR test files — validated for no ERROR nodes |

Tier 2 examples are synced from the [LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test) across 11 core dialects:

| Dialect | Files | Pass Rate |
|---------|------:|----------:|
| ControlFlow | 5 | 80.0% |
| SCF | 41 | 78.1% |
| MemRef | 28 | 75.0% |
| Tensor | 29 | 69.0% |
| Arith | 21 | 66.7% |
| Builtin | 3 | 66.7% |
| Vector | 81 | 50.6% |
| Func | 2 | 50.0% |
| Affine | 49 | 49.0% |
| Linalg | 139 | 44.6% |
| IR | 5 | 40.0% |
| **Total** | **403** | **55.3%** |

## Usage

### Editor Integration

#### [Zed](https://zed.dev)

Not publish yet, if you want to install it, please see [zed-mlir](https://github.com/felixtensor/zed-mlir) and build it manually.

#### Neovim (nvim-treesitter)

Add `mlir` to your `nvim-treesitter` configuration.

### Development

```bash
# Install dependencies
npm install

# Generate parser from grammar
npm run compile

# Run Tier 1 corpus tests
npm test

# Run Tier 2 examples tests
npm run test:examples

# Run all tests
npm run test:all

# Update examples from a local llvm-project checkout
./scripts/sync-examples.sh /path/to/llvm-project
```

## License

[Apache-2.0](./LICENSE)
