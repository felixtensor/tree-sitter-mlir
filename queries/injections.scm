; Intentionally empty.
;
; MLIR IR does not contain a stable child language that should be injected from
; inside .mlir files. Embedding MLIR inside another language, such as C++ raw
; strings using R"mlir(...)mlir", is handled by that host language's own
; injection query. This file exists so bindings can expose a valid injection
; query path without activating any MLIR-side injection patterns.
