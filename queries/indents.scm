;; ---------------------------------------------------------------------------
;; MLIR indentation rules
;;
;; MLIR is bracket-structured: regions delimited by { ... } drive all
;; indentation. This matches VS Code's default behavior — vscode-mlir
;; defines no custom indentationRules, relying on bracket-based defaults.
;; Only { ... } controls indent levels; ( ... ), [ ... ], and < ... > are
;; handled by editor defaults for bracket matching / alignment.
;; ---------------------------------------------------------------------------

;; Regions introduce a new indent level.
(region) @indent.begin

;; Region closing braces return to the parent indent level.
(region "}" @indent.branch)

;; Block labels (^bb0, ^bb1) sit at the region's brace level, not
;; indented as body content inside it.
(block_label) @indent.branch

;; Comments and string literals do not affect indentation.
(comment) @indent.ignore
(string_literal) @indent.ignore
