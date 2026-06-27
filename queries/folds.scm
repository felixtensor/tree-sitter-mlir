;; ---------------------------------------------------------------------------
;; MLIR code folding
;;
;; MLIR is bracket-structured: regions delimited by { ... } are the only
;; construct that meaningfully benefits from folding. Attribute dictionaries
;; ({key = value, ...}) and external resources ({-# ... #-}) are typically
;; short enough to leave visible; folding them adds noise without value.
;; ---------------------------------------------------------------------------

(region) @fold
