;; ---------------------------------------------------------------------------
;; MLIR code navigation — symbol outline (e.g. tagbar / breadcrumbs).
;;
;; MLIR is compiler-generated IR; most constructs (SSA values, dialect ops,
;; type/attribute aliases) do not define "named" symbols with a stable @name
;; field on the defining node. This file covers the constructs that do:
;; functions, modules, and block labels.
;;
;; Standard tree-sitter tags captures are used throughout:
;;   https://tree-sitter.github.io/tree-sitter/code-navigation
;; ---------------------------------------------------------------------------

;; Named functions: func.func @my_func(...)
(func_operation
  sym_name: (symbol_ref_id) @name) @definition.function

;; Named modules: module @my_module { ... }
(module_operation
  sym_name: (symbol_ref_id) @name) @definition.module

;; Unnamed modules: module attributes { ... }  (no @name field)
(module_operation
  !sym_name) @definition.module

;; Block labels: ^bb0(%arg0: i64):
(block_label
  (caret_id) @name) @item
