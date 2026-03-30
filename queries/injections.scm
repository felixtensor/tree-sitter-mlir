; MLIR typically doesn't contain standard language injections inside its own files.
; However, if you are working with C++ code that embeds MLIR via raw string literals,
; you can add the following snippet to your editor's `cpp` injections
; (e.g., `languages/cpp/injections.scm` in Zed, or equivalent Neovim config)
; to automatically highlight MLIR inside `R"mlir(...)mlir"`:

; (raw_string_literal
;   delimiter: (raw_string_delimiter) @delim
;   (#eq? @delim "mlir")
;   content: (raw_string_content) @injection.content
;   (#set! injection.language "mlir"))
