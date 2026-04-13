# tree-sitter-mlir Bindings

**WARNING: Untested and Unverified Bindings**

The `tree-sitter-mlir` grammar itself targets generic MLIR syntax and has been tested with Tree-sitter's CLI and Rust tools. However, the language bindings contained in this `bindings/` directory (including C, Go, Node, Python, Rust, and Swift) **have never been seriously tested**. 

It is uncertain whether these bindings still function correctly, build successfully, or are up-to-date with the current tree-sitter core API versions. Use them at your own risk.

If you intend to use this parser from one of these languages, you may need to resolve build or integration issues. Contributions to fix and establish proper testing for these bindings are highly welcome!
