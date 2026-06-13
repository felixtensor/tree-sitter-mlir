# Highlight Fixtures

Highlight fixtures are grouped by the MLIR syntax layer they exercise. This
keeps each file focused while avoiding a flat directory of unrelated cases.

This file intentionally lives outside `test/highlight/`, because
`tree-sitter test` treats files in that directory as highlight fixtures.

- `core/`: common IR syntax, operation forms, blocks, regions, affine syntax,
  function signatures, operands, results, successors, and terminators.
- `attributes/`: attribute aliases, attribute dictionaries, builtin attribute
  values, strings, locations, metadata blocks, and dense resources.
- `types/`: builtin and dialect type syntax, shape dimensions, memref, tensor,
  and vector forms.
- `assembly/`: custom and pretty assembly forms such as dialect-specific
  payloads, symbol arguments, successors, and resource-backed pretty syntax.
- `integration/`: broader registered-dialect snippets that exercise several
  highlight layers together.

When adding coverage, prefer a small topic fixture in the narrowest matching
directory. Keep broad end-to-end examples in `integration/` only when they are
exercising several syntax layers rather than one isolated feature.

Fixtures should be credible MLIR, not parser-shaped text invented only for the
highlighter. Prefer examples adapted from the MLIR language reference or from
`llvm-project/mlir/test`. For new examples, verify them with a compatible MLIR
toolchain, such as `mlir-opt --verify-diagnostics`, before adding assertions.
Unregistered downstream dialect syntax belongs in a separate compatibility
fixture only when its source and validation path are clear.
