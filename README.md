# tree-sitter-mlir

[MLIR](https://mlir.llvm.org) grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter).

## Acknowledgments

This project is based on the work of [Ramkumar Ramachandra](https://github.com/artagnon) ([artagnon/tree-sitter-mlir](https://github.com/artagnon/tree-sitter-mlir)), who created the original tree-sitter grammar for MLIR. The original project is licensed under [Apache-2.0](./LICENSE).

## Status

The parser targets [generic MLIR syntax](https://mlir.llvm.org/docs/LangRef/) rather than individual dialect-specific assembly formats. It also supports MLIR's "default dialect" mechanism, where operations inside a region may omit the dialect prefix.

> **Note on Language Bindings:** While the repository contains bindings for several languages (C, Go, Node, Python, Rust, Swift) under the `bindings/` directory, these have not been rigorously tested. It is uncertain whether they are fully functional or up to date with the latest tree-sitter versions. Please use them with caution, and contributions to test or fix them are welcome!

### Test Coverage

We use a two-tier test architecture following [tree-sitter community conventions](https://github.com/tree-sitter/tree-sitter-rust):

| Tier | Directory | Tool | Description |
|------|-----------|------|-------------|
| **1** | `test/corpus/` | `tree-sitter test` | Hand-written tests with exact AST snapshot matching |
| **2** | `examples/` | `tree-sitter parse` | Official MLIR test files — validated for no ERROR nodes |

Tier 2 examples are synced from the [LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test) across 11 core dialects:

| Dialect | Files | Pass Rate |
|---------|------:|----------:|
| Affine | 49 | 100.0% |
| Arith | 21 | 100.0% |
| Builtin | 3 | 100.0% |
| ControlFlow | 5 | 100.0% |
| Func | 2 | 100.0% |
| IR | 5 | 100.0% |
| Linalg | 139 | 100.0% |
| MemRef | 28 | 100.0% |
| SCF | 41 | 100.0% |
| Tensor | 29 | 100.0% |
| Vector | 81 | 100.0% |
| **Total** | **403** | **100.0%** |

## Features

### Syntax Highlighting

Comprehensive highlighting via `queries/highlights.scm`, covering:

- **Operations** — Tier-1 structural ops (`func.func`, `module`), dialect ops (`arith.addi`), and generic ops (`"dialect.op"`)
- **Types** — all builtin types (`i32`, `f32`, `memref`, `tensor`, `vector`, etc.) and dialect/alias types
- **Attributes** — attribute aliases (`#map`), dialect attributes, dictionary attributes, affine maps/sets
- **Literals** — integers, floats, booleans, strings, complex, tensor/array literals, `dense_resource`, `unit`, `uninitialized`
- **SSA variables** — `%name` with distinct highlighting for function/block parameters vs. general uses
- **Control flow** — block labels (`^bb0`), successor references
- **Symbols** — `@name` references with function-specific overrides
- **Punctuation & operators** — brackets, delimiters, `->`, `::`, `=`

Highlight tests cover 5 files with 142 assertions across attributes, functions, control flow, downstream dialects, and types.

### Local Scopes

`queries/locals.scm` provides scope-aware symbol resolution:

- Regions define local scopes
- Function arguments, block arguments, and op results are tracked as local definitions
- Value uses (`%name`) are tracked as local references

### C++ Injection Support

`queries/injections.scm` includes a ready-to-use snippet for highlighting MLIR embedded in C++ raw string literals (`R"mlir(...)mlir"`). Copy the commented template into your editor's C++ injection config to enable it.

## Usage

### Editor Integration

#### [Zed](https://zed.dev)

Not published yet. To install, see [zed-mlir](https://github.com/felixtensor/zed-mlir) and build manually.

#### Neovim (nvim-treesitter)

Add `mlir` to your `nvim-treesitter` configuration.

#### Other Editors

Any tree-sitter-compatible editor (Helix, Emacs, etc.) can use the grammar and queries directly.

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
