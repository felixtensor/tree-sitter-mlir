;; ---------------------------------------------------------------------------
;; MLIR code navigation — symbol tags (functions and named modules).
;;
;; MLIR is compiler-generated IR; most constructs (SSA values, block labels,
;; dialect ops, type/attribute aliases) do not define globally navigable named
;; symbols with a stable @name field. This file covers the constructs that do:
;; named functions and named modules.
;;
;; Standard tree-sitter tags captures are used throughout:
;;   https://tree-sitter.github.io/tree-sitter/code-navigation
;; ---------------------------------------------------------------------------

;; Named functions: func.func @my_func(...)
(func_operation
  sym_name: (symbol_ref_id) @name) @definition.function

;; Named modules: module @my_module { ... }
;; Unnamed modules (`module { ... }`) have no @name and are omitted because
;; tree-sitter-tags drops definitions without a @name capture.
(module_operation
  sym_name: (symbol_ref_id) @name) @definition.module
