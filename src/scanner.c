#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  CARET_ID,
  BLOCK_LABEL_ID,
  CUSTOM_BODY_DIMENSION_SEPARATOR,
};

void *tree_sitter_mlir_external_scanner_create(void) { return NULL; }

void tree_sitter_mlir_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_mlir_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_mlir_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static bool is_digit(int32_t c) { return c >= '0' && c <= '9'; }

static bool is_inline_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\f' || c == '\v';
}

static bool is_identifier_start(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' ||
         c == '$' || c == '.' || c == '-';
}

static bool is_identifier_char(int32_t c) {
  return is_identifier_start(c) || is_digit(c);
}

static bool skip_space(TSLexer *lexer, bool skip) {
  bool saw_newline = false;

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
         lexer->lookahead == '\f' || lexer->lookahead == '\v') {
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      saw_newline = true;
    }
    lexer->advance(lexer, skip);
  }

  return saw_newline;
}

static void skip_inline_space(TSLexer *lexer, bool skip) {
  while (is_inline_space(lexer->lookahead)) {
    lexer->advance(lexer, skip);
  }
}

static bool scan_digits(TSLexer *lexer) {
  if (!is_digit(lexer->lookahead)) {
    return false;
  }

  do {
    lexer->advance(lexer, false);
  } while (is_digit(lexer->lookahead));

  return true;
}

static bool scan_custom_body_dimension_separator(TSLexer *lexer) {
  skip_inline_space(lexer, true);

  if (lexer->lookahead != 'x') {
    return false;
  }

  lexer->advance(lexer, false);
  lexer->mark_end(lexer);

  skip_inline_space(lexer, false);

  // Confirm at least one digit follows `x`, which distinguishes
  // dimension separators (16x16) from a bare identifier `x` in
  // custom assembly (the grammar's valid_symbols gate ensures this
  // scanner is only called where a separator is expected).
  if (!scan_digits(lexer)) {
    return false;
  }

  return true;
}

static bool skip_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') {
    return false;
  }

  lexer->advance(lexer, false);
  if (lexer->lookahead != '/') {
    return false;
  }

  while (lexer->lookahead != '\0' && lexer->lookahead != '\n' &&
         lexer->lookahead != '\r') {
    lexer->advance(lexer, false);
  }

  return true;
}

static bool skip_label_extras(TSLexer *lexer) {
  bool saw_newline = false;

  for (;;) {
    saw_newline = skip_space(lexer, false) || saw_newline;
    if (!skip_comment(lexer)) {
      return saw_newline;
    }
  }
}

static bool at_block_label_tail(TSLexer *lexer) {
  skip_label_extras(lexer);

  if (lexer->lookahead == '(') {
    int32_t depth = 1;
    lexer->advance(lexer, false);
    while (depth > 0) {
      skip_label_extras(lexer);
      switch (lexer->lookahead) {
        case '\0':
          return false;
        case '"':
          // Consume a string literal opaquely so brackets or `//` inside it
          // are not counted as nesting delimiters or comments.
          lexer->advance(lexer, false);
          while (lexer->lookahead != '"' && lexer->lookahead != '\0') {
            if (lexer->lookahead == '\\') {
              lexer->advance(lexer, false);
            }
            lexer->advance(lexer, false);
          }
          if (lexer->lookahead == '\0') {
            return false;
          }
          break;
        case '(':
        case '<':
        case '[':
          depth++;
          break;
        case ')':
        case '>':
        case ']':
          depth--;
          break;
        default:
          break;
      }
      lexer->advance(lexer, false);
    }
  }

  skip_label_extras(lexer);

  return lexer->lookahead == ':';
}

bool tree_sitter_mlir_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  (void)payload;

  // Snapshot line-start before the dimension-separator probe, which can
  // advance past leading inline space and shift the column.
  bool at_line_start = lexer->get_column(lexer) == 0;

  // A failed probe may leave the lexer past `x`; the caret/block-label
  // fall-through stays safe because neither CARET_ID nor BLOCK_LABEL_ID is
  // ever valid at a position starting with `x`.
  if (valid_symbols[CUSTOM_BODY_DIMENSION_SEPARATOR] &&
      scan_custom_body_dimension_separator(lexer)) {
    lexer->result_symbol = CUSTOM_BODY_DIMENSION_SEPARATOR;
    return true;
  }

  bool skipped_newline = skip_space(lexer, true);
  at_line_start = at_line_start || skipped_newline;

  if (lexer->lookahead != '^') {
    return false;
  }

  lexer->advance(lexer, false);
  if (is_digit(lexer->lookahead)) {
    do {
      lexer->advance(lexer, false);
    } while (is_digit(lexer->lookahead));
  } else if (is_identifier_start(lexer->lookahead)) {
    do {
      lexer->advance(lexer, false);
    } while (is_identifier_char(lexer->lookahead));
  } else {
    return false;
  }

  lexer->mark_end(lexer);

  if (lexer->lookahead == ':' || lexer->lookahead == '#') {
    int32_t suffix_separator = lexer->lookahead;
    lexer->advance(lexer, false);
    if (is_digit(lexer->lookahead)) {
      do {
        lexer->advance(lexer, false);
      } while (is_digit(lexer->lookahead));
      lexer->mark_end(lexer);
    } else if (suffix_separator == ':') {
      if (at_line_start && valid_symbols[BLOCK_LABEL_ID]) {
        lexer->result_symbol = BLOCK_LABEL_ID;
        return true;
      }
      return false;
    } else {
      return false;
    }
  }

  bool is_block_label = at_line_start && at_block_label_tail(lexer);
  if (is_block_label && valid_symbols[BLOCK_LABEL_ID]) {
    lexer->result_symbol = BLOCK_LABEL_ID;
    return true;
  }
  if (!is_block_label && valid_symbols[CARET_ID]) {
    lexer->result_symbol = CARET_ID;
    return true;
  }

  return false;
}
