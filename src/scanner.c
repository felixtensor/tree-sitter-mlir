#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  CARET_ID,
  BLOCK_LABEL_ID,
  CUSTOM_BODY_DIMENSION_SEPARATOR,
  OP_RESULT_SIGIL,
  GENERIC_OP_QUOTE,
  CUSTOM_BODY_OPAQUE_BRACE_GROUP,
  ATTRIBUTE_ALIAS_SIGIL,
  TYPE_ALIAS_SIGIL,
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

// A custom operation name (`_dotted_op_name`, `_bare_op_name`, `bare_id`) or
// the string literal that names a generic operation.
static bool is_operation_name_start(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' ||
         c == '"';
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

// Precondition: the lexer is positioned at `x`. Consumes `x` and requires a
// dimension to follow -- a digit (static size, 16x16) or `?` (dynamic size,
// 16x?). This distinguishes a dimension separator from a bare identifier `x`
// in custom assembly (the grammar's valid_symbols gate ensures this scanner
// is only called where a separator is expected).
static bool scan_dimension_separator_from_x(TSLexer *lexer) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);

  skip_inline_space(lexer, false);

  return is_digit(lexer->lookahead) || lexer->lookahead == '?';
}

typedef enum {
  COMMENT_NOT_FOUND,
  LINE_COMMENT,
  SINGLE_SLASH,
} CommentScanResult;

typedef enum {
  EXTRAS_READY,
  EXTRAS_SINGLE_SLASH,
} ExtrasScanResult;

static CommentScanResult skip_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') {
    return COMMENT_NOT_FOUND;
  }

  lexer->advance(lexer, false);
  if (lexer->lookahead != '/') {
    return SINGLE_SLASH;
  }

  while (lexer->lookahead != '\0' && lexer->lookahead != '\n' &&
         lexer->lookahead != '\r') {
    lexer->advance(lexer, false);
  }

  return LINE_COMMENT;
}

// Skip whitespace and line comments. A single slash is consumed before the
// result is reported so callers that scan opaque body text can continue from
// the following character without mistaking the slash for a comment.
static ExtrasScanResult skip_extras(TSLexer *lexer) {
  for (;;) {
    skip_space(lexer, false);
    CommentScanResult comment = skip_comment(lexer);
    if (comment == COMMENT_NOT_FOUND) {
      return EXTRAS_READY;
    }
    if (comment == SINGLE_SLASH) {
      return EXTRAS_SINGLE_SLASH;
    }
  }
}

typedef enum {
  BLOCK_LABEL_TAIL_NOT_FOUND,
  BLOCK_LABEL_TAIL_FOUND,
  OUTER_BRACE_CLOSED,
} BlockLabelTailResult;

static BlockLabelTailResult at_block_label_tail(TSLexer *lexer,
                                                int *brace_depth);

// Skip extras while probing the first meaningful character after `{`. This is
// deliberately local to the opaque-brace probe: the grammar still owns all
// ordinary brace syntax and the scanner must not become a second lexer.
static bool skip_brace_leading_extras(TSLexer *lexer) {
  return skip_extras(lexer) == EXTRAS_READY;
}

// Precondition: the lexer is positioned after the opening `{`, and the
// caller has already established that the first meaningful character is an
// unsafe custom-body lead. Consume the rest of one balanced brace group,
// ignoring braces in strings and line comments. Returning false lets
// tree-sitter restore the original position, which is important for malformed
// input: an unclosed group must remain available to grammar recovery.
static bool scan_opaque_brace_tail(TSLexer *lexer, int depth) {
  bool in_string = false;

  while (lexer->lookahead != '\0') {
    if (in_string) {
      if (lexer->lookahead == '\\') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '\0') {
          return false;
        }
        lexer->advance(lexer, false);
      } else if (lexer->lookahead == '"') {
        in_string = false;
        lexer->advance(lexer, false);
      } else {
        lexer->advance(lexer, false);
      }
      continue;
    }

    if (lexer->lookahead == '"') {
      in_string = true;
      lexer->advance(lexer, false);
      continue;
    }

    if (lexer->lookahead == '/') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '/') {
        while (lexer->lookahead != '\0' && lexer->lookahead != '\n' &&
               lexer->lookahead != '\r') {
          lexer->advance(lexer, false);
        }
      }
      continue;
    }

    if (lexer->lookahead == '{') {
      depth++;
      lexer->advance(lexer, false);
      continue;
    }
    if (lexer->lookahead == '}') {
      depth--;
      lexer->advance(lexer, false);
      if (depth == 0) {
        lexer->mark_end(lexer);
        return true;
      }
      continue;
    }

    lexer->advance(lexer, false);
  }

  return false;
}

// Precondition: the lexer is positioned at `{`. The scanner claims the group
// only when its first meaningful token cannot begin any structured brace
// reading. `#` and `!` cannot begin a region, dictionary entry or known
// custom-body payload. A `^` lead is claimed only when it is not followed by
// the block-label shape that starts a real region.
static bool scan_opaque_brace_group(TSLexer *lexer) {
  lexer->advance(lexer, false);
  if (!skip_brace_leading_extras(lexer)) {
    return false;
  }

  if (lexer->lookahead == '#' || lexer->lookahead == '!') {
    return scan_opaque_brace_tail(lexer, 1);
  }

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
    return scan_opaque_brace_tail(lexer, 1);
  }

  // A colon immediately after the block id is the compact block-label form.
  // Optional numeric suffixes are consumed before checking the label tail.
  if (lexer->lookahead == ':') {
    lexer->advance(lexer, false);
    if (!is_digit(lexer->lookahead)) {
      return false;
    }
    do {
      lexer->advance(lexer, false);
    } while (is_digit(lexer->lookahead));
  }
  if (lexer->lookahead == '#') {
    lexer->advance(lexer, false);
    if (!is_digit(lexer->lookahead)) {
      return scan_opaque_brace_tail(lexer, 1);
    }
    do {
      lexer->advance(lexer, false);
    } while (is_digit(lexer->lookahead));
  }

  int brace_depth = 1;
  BlockLabelTailResult block_label_tail =
      at_block_label_tail(lexer, &brace_depth);
  if (block_label_tail == BLOCK_LABEL_TAIL_FOUND) {
    return false;
  }
  if (block_label_tail == OUTER_BRACE_CLOSED) {
    return true;
  }
  return scan_opaque_brace_tail(lexer, brace_depth);
}

static bool skip_label_extras(TSLexer *lexer) {
  return skip_extras(lexer) == EXTRAS_READY;
}

// Precondition: the lexer is positioned at `#` or `!`. Consume an alias
// definition lead (`#name =` / `!name =`) without consuming the sigil past the
// token boundary. The grammar parses the identifier and value/type normally.
static bool scan_alias_definition_sigil(TSLexer *lexer) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  if (!((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
        (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
        lexer->lookahead == '_')) {
    return false;
  }
  do {
    lexer->advance(lexer, false);
  } while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
           (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
           is_digit(lexer->lookahead) || lexer->lookahead == '_' ||
           lexer->lookahead == '$');
  if (!skip_label_extras(lexer)) {
    return false;
  }
  return lexer->lookahead == '=';
}

static BlockLabelTailResult at_block_label_tail(TSLexer *lexer,
                                                int *brace_depth) {
  bool has_outer_brace = *brace_depth > 0;
  if (!skip_label_extras(lexer)) {
    return BLOCK_LABEL_TAIL_NOT_FOUND;
  }

  if (lexer->lookahead == '(') {
    int32_t depth = 1;
    lexer->advance(lexer, false);
    while (depth > 0) {
      // A single slash is ordinary content while scanning a block argument
      // type (for example, `!dialect.type<foo/bar>`). Unlike the token-boundary
      // probes above and below, this delimiter scan ignores the status because
      // skip_extras has already consumed the slash.
      (void)skip_extras(lexer);
      switch (lexer->lookahead) {
        case '\0':
          return BLOCK_LABEL_TAIL_NOT_FOUND;
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
            return BLOCK_LABEL_TAIL_NOT_FOUND;
          }
          break;
        case '(':
        case '<':
        case '[':
          depth++;
          break;
        case '{':
          (*brace_depth)++;
          break;
        case '}':
          if (*brace_depth == 0) {
            return BLOCK_LABEL_TAIL_NOT_FOUND;
          }
          (*brace_depth)--;
          if (has_outer_brace && *brace_depth == 0) {
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);
            return OUTER_BRACE_CLOSED;
          }
          break;
        case '-':
          // An MLIR affine map arrow inside a block argument type (for
          // example, `#sparse_tensor.encoding<{map = (d0) -> (d0)}>`)
          // is not an angle-bracket terminator. Consume the arrow together so
          // its `>` does not close the surrounding dialect or tensor body.
          lexer->advance(lexer, false);
          if (lexer->lookahead == '>') {
            lexer->advance(lexer, false);
          }
          continue;
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

  if (!skip_label_extras(lexer)) {
    return BLOCK_LABEL_TAIL_NOT_FOUND;
  }

  return lexer->lookahead == ':' ? BLOCK_LABEL_TAIL_FOUND
                                 : BLOCK_LABEL_TAIL_NOT_FOUND;
}

// Consumes a suffix-id with the same spelling as the grammar's `_suffix_id`
// token: digits, or an identifier, then an optional `:digits` or `#digits`.
// Returns false when the text after `%` is not a suffix-id.
static bool scan_suffix_id(TSLexer *lexer) {
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

  if (lexer->lookahead == ':' || lexer->lookahead == '#') {
    lexer->advance(lexer, false);
    if (!is_digit(lexer->lookahead)) {
      return false;
    }
    do {
      lexer->advance(lexer, false);
    } while (is_digit(lexer->lookahead));
  }

  return true;
}

// Precondition: the lexer is positioned at `%`. Consumes only the `%` as the
// token, so the grammar parses the value id as it does any value_use. Then
// looks ahead without consuming for the rest of an op-result-list: the value
// id, (`,` value-id)* `=` and the start of an operation name (a bare or dotted
// identifier, or the string of a generic operation). A custom body uses `%x =`
// too (`scf.for %i = %lb`, `(%gx = %a)`), but with a value after the `=`.
static bool scan_op_result_sigil(TSLexer *lexer) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  if (!scan_suffix_id(lexer)) {
    return false;
  }

  for (;;) {
    if (!skip_label_extras(lexer)) {
      return false;
    }
    if (lexer->lookahead == '=') {
      lexer->advance(lexer, false);
      if (!skip_label_extras(lexer)) {
        return false;
      }
      return is_operation_name_start(lexer->lookahead);
    }
    if (lexer->lookahead != ',') {
      return false;
    }
    lexer->advance(lexer, false);
    if (!skip_label_extras(lexer)) {
      return false;
    }
    if (lexer->lookahead != '%') {
      return false;
    }
    lexer->advance(lexer, false);
    if (!scan_suffix_id(lexer)) {
      return false;
    }
  }
}

// Precondition: the lexer is positioned at `"`. Consumes only the opening quote
// as the token, so the grammar parses the rest of the name as it does any
// string_literal. Then looks ahead without consuming past the closing quote
// for a generic operand list, `(` (value-id (`,` value-id)*)? `)`, followed by
// what a generic operation allows next: `:`, `[`, `<{`, `(` or `{`. A custom
// body's quoted name before `(` carries more than values, as in
// `with "rewriter"(%x : !pdl.value)`.
static bool scan_generic_op_quote(TSLexer *lexer) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);

  while (lexer->lookahead != '"') {
    switch (lexer->lookahead) {
      case '\0':
      case '\n':
      case '\r':
      case '\f':
      case '\v':
        return false;
      case '\\':
        // Step over the escaped character so an escaped quote does not end
        // the name; the grammar decides whether the escape is valid.
        lexer->advance(lexer, false);
        if (lexer->lookahead == '\0' || lexer->lookahead == '\n' ||
            lexer->lookahead == '\r') {
          return false;
        }
        lexer->advance(lexer, false);
        break;
      default:
        lexer->advance(lexer, false);
    }
  }
  lexer->advance(lexer, false);

  if (!skip_label_extras(lexer)) {
    return false;
  }
  if (lexer->lookahead != '(') {
    return false;
  }
  lexer->advance(lexer, false);
  if (!skip_label_extras(lexer)) {
    return false;
  }
  if (lexer->lookahead == '%') {
    for (;;) {
      lexer->advance(lexer, false);
      if (!scan_suffix_id(lexer)) {
        return false;
      }
      if (!skip_label_extras(lexer)) {
        return false;
      }
      if (lexer->lookahead != ',') {
        break;
      }
      lexer->advance(lexer, false);
      if (!skip_label_extras(lexer)) {
        return false;
      }
      if (lexer->lookahead != '%') {
        return false;
      }
    }
  }
  if (lexer->lookahead != ')') {
    return false;
  }
  lexer->advance(lexer, false);
  if (!skip_label_extras(lexer)) {
    return false;
  }

  switch (lexer->lookahead) {
    case ':':
    case '[':
    case '(':
    case '{':
      return true;
    case '<':
      lexer->advance(lexer, false);
      return lexer->lookahead == '{';
    default:
      return false;
  }
}

bool tree_sitter_mlir_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  (void)payload;

  // Snapshot line-start before the dimension-separator probe, which can
  // advance past leading inline space and shift the column.
  bool at_line_start = lexer->get_column(lexer) == 0;
  bool caret_is_adjacent = lexer->lookahead == '^';

  // A dimension separator is the only external token that can begin with `x`.
  // When one is expected, skip leading inline space and decide on `x`
  // definitively. Committing to consume `x` means we must NOT fall through to
  // the caret/block-label scan below: it would resume past the consumed `x`
  // and swallow it into the emitted token (e.g. turning `16x^bb0` into a
  // caret_id spanning `x^bb0`). If the `x` is not a separator, return false so
  // tree-sitter resets to the original position and re-lexes `x` internally.
  if (valid_symbols[CUSTOM_BODY_DIMENSION_SEPARATOR]) {
    skip_inline_space(lexer, true);
    if (lexer->lookahead == 'x') {
      if (scan_dimension_separator_from_x(lexer)) {
        lexer->result_symbol = CUSTOM_BODY_DIMENSION_SEPARATOR;
        return true;
      }
      return false;
    }
  }

  bool skipped_newline = skip_space(lexer, true);
  at_line_start = at_line_start || skipped_newline;

  if (lexer->lookahead == '#') {
    if (at_line_start && valid_symbols[ATTRIBUTE_ALIAS_SIGIL] &&
        scan_alias_definition_sigil(lexer)) {
      lexer->result_symbol = ATTRIBUTE_ALIAS_SIGIL;
      return true;
    }
    return false;
  }
  if (lexer->lookahead == '!') {
    if (at_line_start && valid_symbols[TYPE_ALIAS_SIGIL] &&
        scan_alias_definition_sigil(lexer)) {
      lexer->result_symbol = TYPE_ALIAS_SIGIL;
      return true;
    }
    return false;
  }

  if (valid_symbols[CUSTOM_BODY_OPAQUE_BRACE_GROUP] &&
      lexer->lookahead == '{') {
    if (scan_opaque_brace_group(lexer)) {
      lexer->result_symbol = CUSTOM_BODY_OPAQUE_BRACE_GROUP;
      return true;
    }
    return false;
  }

  // At a region opening such as `{^bb0: ...}`, the grammar can require a
  // block label even though the caret is not at column zero or after a
  // newline. Accept that compact form when no leading extra separates the
  // caret from the previous token. Keep the line-start requirement for
  // whitespace-separated successor/type syntax such as `^bb0 : i32`.
  bool can_be_block_label =
      valid_symbols[BLOCK_LABEL_ID] &&
      (at_line_start || caret_is_adjacent || !valid_symbols[CARET_ID]);

  // The next two tokens end a preceding custom body at the start of the next
  // operation. Both require line start: an operation may span lines, but a
  // new one starts its own, while mid-line the same shapes are body syntax,
  // such as a loop bound `%i = max ...`.
  if (lexer->lookahead == '%') {
    if (valid_symbols[OP_RESULT_SIGIL] && at_line_start &&
        scan_op_result_sigil(lexer)) {
      lexer->result_symbol = OP_RESULT_SIGIL;
      return true;
    }
    return false;
  }

  if (lexer->lookahead == '"') {
    if (valid_symbols[GENERIC_OP_QUOTE] && at_line_start &&
        scan_generic_op_quote(lexer)) {
      lexer->result_symbol = GENERIC_OP_QUOTE;
      return true;
    }
    return false;
  }

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
      if (can_be_block_label) {
        lexer->result_symbol = BLOCK_LABEL_ID;
        return true;
      }
      return false;
    } else {
      return false;
    }
  }

  int brace_depth = 0;
  BlockLabelTailResult block_label_tail =
      at_block_label_tail(lexer, &brace_depth);
  bool is_block_label = can_be_block_label &&
                        block_label_tail == BLOCK_LABEL_TAIL_FOUND;
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
