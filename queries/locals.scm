;; ---------------------------------------------------------------------------
;; MLIR locals — scopes, definitions, and references.
;;
;; Drives scope-aware highlighting and go-to-definition. Definitions and
;; references are linked by node text within the nearest enclosing scope, so
;; each capture targets the bare identifier node (carrying its %/^/@/!/# sigil)
;; rather than the surrounding construct. Broad @local.reference patterns are
;; deliberately paired with more specific @local.definition patterns; the
;; definition role takes priority for any node matched by both.
;; ---------------------------------------------------------------------------

;; ── Scopes ──────────────────────────────────────────────────────────────────
;; Every region opens a fresh SSA value / block-label scope. The file-level
;; toplevel scope holds module-wide symbols and type/attribute aliases, which
;; references inside nested regions resolve outward to.
(toplevel) @local.scope
(region) @local.scope

;; ── SSA value definitions (%name) ───────────────────────────────────────────
;; Operation results, function parameters, and block arguments. op_result wraps
;; the defining value_use (plus an optional `:N` count); capture the value_use
;; so its text matches downstream uses.
(op_result (value_use) @local.definition)
(func_arg_list (value_use) @local.definition)
(block_arg_list (value_use) @local.definition)

;; ── Block label definitions (^name) ─────────────────────────────────────────
(block_label (caret_id) @local.definition)

;; ── Symbol definitions (@name) ──────────────────────────────────────────────
(func_operation sym_name: (symbol_ref_id) @local.definition)
(module_operation sym_name: (symbol_ref_id) @local.definition)

;; ── Type / attribute alias definitions (!alias / #alias) ────────────────────
;; The grammar hides the alias identifier inside *_alias_def, so the whole
;; definition node is the only available handle. It marks the node as a
;; definition for symbol-listing consumers; exact text-linking to !alias /
;; #alias uses is limited until the alias name is exposed as its own node.
(type_alias_def) @local.definition
(attribute_alias_def) @local.definition

;; ── References ──────────────────────────────────────────────────────────────
(value_use) @local.reference
(caret_id) @local.reference
(symbol_ref_id) @local.reference
(type_alias) @local.reference
(attribute_alias) @local.reference
