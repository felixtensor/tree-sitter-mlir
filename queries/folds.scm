;; ---------------------------------------------------------------------------
;; MLIR code folding
;;
;; MLIR is bracket-structured: regions delimited by { ... } and external
;; resource blocks ({-# ... #-}, which often hold large weight payloads) are
;; the constructs that meaningfully benefit from folding. Attribute
;; dictionaries ({key = value, ...}) are left unfolded to avoid noise.
;; ---------------------------------------------------------------------------

(region) @fold
(external_resources) @fold
