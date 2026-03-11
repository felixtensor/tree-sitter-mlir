#include "tree_sitter/parser.h"

// Token types from the externals array in grammar.js
enum TokenType {
  RESULT_VALUE_USE,
};

// External scanner: detects `%suffix_id` when followed by `=`
// This distinguishes operation results (%x = op ...) from operands (%x)
// in custom operation bodies.

void *tree_sitter_mlir_external_scanner_create(void) {
  return NULL;
}

void tree_sitter_mlir_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_mlir_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  return 0;
}

void tree_sitter_mlir_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {}

// Check if character is valid in a suffix-id
static bool is_suffix_id_char(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
         (c >= '0' && c <= '9') || c == '_' || c == '$' || c == '.' ||
         c == '-';
}

bool tree_sitter_mlir_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  // Only try to match when RESULT_VALUE_USE is valid
  if (!valid_symbols[RESULT_VALUE_USE]) {
    return false;
  }

  // During error recovery, all valid_symbols are true.
  // Be conservative and don't match to avoid interfering.
  // We detect error recovery by checking if tokens that should never
  // be simultaneously valid ARE simultaneously valid. Since we only have
  // one external token, we can't use this trick. Instead, we rely on
  // the careful matching logic below.

  // Must start with '%'
  if (lexer->lookahead != '%') {
    return false;
  }

  // Consume '%'
  lexer->advance(lexer, false);

  // Must have at least one suffix-id character
  if (!is_suffix_id_char(lexer->lookahead)) {
    return false;
  }

  // Consume suffix-id characters
  while (is_suffix_id_char(lexer->lookahead)) {
    lexer->advance(lexer, false);
  }

  // Optional `:` or `#` followed by digits (e.g., %result:0, %result#1)
  if (lexer->lookahead == ':' || lexer->lookahead == '#') {
    lexer->advance(lexer, false);
    if (lexer->lookahead >= '0' && lexer->lookahead <= '9') {
      while (lexer->lookahead >= '0' && lexer->lookahead <= '9') {
        lexer->advance(lexer, false);
      }
    }
  }

  // Skip whitespace (but not newlines — we want to stay on the same logical unit)
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    lexer->advance(lexer, false);
  }

  // Check for '=' (but NOT '==')
  if (lexer->lookahead == '=') {
    // Mark the end of the token BEFORE consuming '='
    // The token is just the %suffix_id part
    lexer->mark_end(lexer);

    // Peek at next character to exclude '=='
    lexer->advance(lexer, false);
    if (lexer->lookahead == '=') {
      return false;  // This is '==', not assignment
    }

    lexer->result_symbol = RESULT_VALUE_USE;
    return true;
  }

  // Check for ',' followed by more results: %a, %b =
  if (lexer->lookahead == ',') {
    lexer->mark_end(lexer);
    lexer->result_symbol = RESULT_VALUE_USE;
    return true;
  }

  return false;
}
