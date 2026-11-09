#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

enum TokenType {
  CARET_ID,
  BLOCK_LABEL_ID,
  CUSTOM_BODY_DIMENSION_SEPARATOR,
  OP_RESULT_SIGIL,
  GENERIC_OP_QUOTE,
  CUSTOM_BODY_OPAQUE_BRACE_GROUP,
  ATTRIBUTE_ALIAS_SIGIL,
  TYPE_ALIAS_SIGIL,
  CUSTOM_BODY_UNCLOSED_BRACE_OPEN,
  CUSTOM_BODY_UNCLOSED_BRACE_PAYLOAD,
  RECOVERY_DOTTED_OP_NAME,
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
                                                int *brace_depth, bool *line_start);

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

// Preserve the opening token's mark while probing a fallback payload. This
// recognizes only its ambiguous string/value lead, not its internal syntax.
static bool scan_suffix_id(TSLexer *lexer);
static bool scan_op_result_sigil(TSLexer *lexer, bool mark, bool *line_start);
static bool scan_generic_op_quote(TSLexer *lexer, bool mark, int *parens);

static bool skip_payload_extras(TSLexer *lexer, bool *line_start) {
  for (;;) {
    *line_start |= skip_space(lexer, false);
    CommentScanResult comment = skip_comment(lexer);
    if (comment == COMMENT_NOT_FOUND)
      return true;
    if (comment == SINGLE_SLASH)
      return false;
  }
}

static bool is_fallback_brace_lead(TSLexer *lexer, bool *line_start) {
  if (lexer->lookahead == '"') {
    lexer->advance(lexer, false);
    while (lexer->lookahead != '"') {
      if (lexer->lookahead == '\0' || lexer->lookahead == '\n' ||
          lexer->lookahead == '\r')
        return false;
      if (lexer->lookahead == '\\') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '\0')
          return false;
      }
      lexer->advance(lexer, false);
    }
    lexer->advance(lexer, false);
    if (!skip_payload_extras(lexer, line_start))
      return true;
    return lexer->lookahead != '=' && lexer->lookahead != ',' &&
           lexer->lookahead != '}' && lexer->lookahead != '(';
  }
  if (lexer->lookahead == '%') {
    lexer->advance(lexer, false);
    if (!scan_suffix_id(lexer))
      return false;
    if (!skip_payload_extras(lexer, line_start))
      return true;
    return lexer->lookahead != '=' && lexer->lookahead != ',' &&
           lexer->lookahead != ':';
  }
  return lexer->lookahead == '@' || lexer->lookahead == '<' ||
         is_digit(lexer->lookahead) || lexer->lookahead == '.' ||
         lexer->lookahead == '=' || lexer->lookahead == ':' ||
         lexer->lookahead == '-' || lexer->lookahead == '*' ||
         lexer->lookahead == '?' || lexer->lookahead == '+' ||
         lexer->lookahead == '/' || lexer->lookahead == '&' ||
         lexer->lookahead == '|' || lexer->lookahead == '~';
}

// A fallback group cannot contain operations at its direct level. Check for
// a close before a line-start operation name; nested groups, strings and
// comments protect their contents. The grammar still builds every CST node.
static bool scan_fallback_brace_tail(TSLexer *lexer, bool line_start,
                                     bool capture, bool *has_payload) {
  int braces = 1, parens = 0, brackets = 0, angles = 0;
  bool in_string = false;
  unsigned steps = 0;
  while (lexer->lookahead != '\0') {
    if (capture) {
      lexer->mark_end(lexer);
      if (steps > 0)
        *has_payload = true;
    }
    steps++;
    int32_t c = lexer->lookahead;
    if (in_string) {
      lexer->advance(lexer, false);
      if (c == '\\' && lexer->lookahead != '\0')
        lexer->advance(lexer, false);
      else if (c == '"')
        in_string = false;
      continue;
    }
    if (c == '\n' || c == '\r') {
      line_start = true;
      lexer->advance(lexer, false);
      continue;
    }
    if (is_inline_space(c)) {
      lexer->advance(lexer, false);
      continue;
    }
    if (c == '/') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '/') {
        while (lexer->lookahead != '\0' && lexer->lookahead != '\n' &&
               lexer->lookahead != '\r')
          lexer->advance(lexer, false);
      } else
        line_start = false;
      continue;
    }
    bool direct_line = line_start && braces == 1 && parens == 0 &&
                       brackets == 0 && angles == 0;
    if (direct_line && c == '%') {
      line_start = false;
      if (scan_op_result_sigil(lexer, false, &line_start))
        return false;
      continue;
    }
    if (direct_line && c == '"') {
      line_start = false;
      if (scan_generic_op_quote(lexer, false, &parens))
        return false;
      continue;
    }
    if (direct_line && c == '^') {
      lexer->advance(lexer, false);
      while (is_identifier_char(lexer->lookahead))
        lexer->advance(lexer, false);
      int nested_braces = 0;
      line_start = false;
      if (at_block_label_tail(lexer, &nested_braces, &line_start) ==
          BLOCK_LABEL_TAIL_FOUND)
        return false;
      continue;
    }
    if (line_start && braces == 1 && parens == 0 && brackets == 0 &&
        angles == 0 &&
        ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_')) {
      char word[32];
      unsigned length = 0;
      bool dotted = false;
      while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
             (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
             is_digit(lexer->lookahead) || lexer->lookahead == '_' ||
             lexer->lookahead == '$' || lexer->lookahead == '.') {
        dotted |= lexer->lookahead == '.';
        if (length < sizeof(word) - 1)
          word[length++] = (char)lexer->lookahead;
        lexer->advance(lexer, false);
      }
      word[length] = '\0';
      if (dotted || strcmp(word, "return") == 0 || strcmp(word, "call") == 0 ||
          strcmp(word, "call_indirect") == 0 || strcmp(word, "constant") == 0 ||
          strcmp(word, "unrealized_conversion_cast") == 0 ||
          strcmp(word, "module") == 0)
        return false;
      line_start = false;
      continue;
    }
    line_start = false;
    if (c == '"')
      in_string = true;
    else if (c == '{')
      braces++;
    else if (c == '}' && --braces == 0)
      return true;
    else if (c == '(')
      parens++;
    else if (c == ')' && parens > 0)
      parens--;
    else if (c == '[')
      brackets++;
    else if (c == ']' && brackets > 0)
      brackets--;
    else if (c == '<' || c == '-') {
      lexer->advance(lexer, false);
      if ((c == '<' && lexer->lookahead == '-') ||
          (c == '-' && lexer->lookahead == '>')) {
        lexer->advance(lexer, false);
      } else if (c == '<')
        angles++;
      continue;
    } else if (c == '>' && angles > 0)
      angles--;
    lexer->advance(lexer, false);
  }
  if (capture && steps > 0) {
    lexer->mark_end(lexer);
    *has_payload = true;
  }
  return false;
}

// Precondition: the lexer is positioned at `{`. The scanner claims the group
// only when its first meaningful token cannot begin any structured brace
// reading. `#` and `!` cannot begin a region, dictionary entry or known
// custom-body payload. A `^` lead is claimed only when it is not followed by
// the block-label shape that starts a real region.
static bool scan_custom_brace_group(TSLexer *lexer, bool allow_unclosed,
                                    bool allow_opaque) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  if (!skip_brace_leading_extras(lexer)) {
    if (!allow_unclosed)
      return false;
    bool closed = scan_fallback_brace_tail(lexer, false, false, NULL);
    if (closed) return false;
    lexer->result_symbol = CUSTOM_BODY_UNCLOSED_BRACE_OPEN;
    return true;
  }

  if (lexer->lookahead == '#' || lexer->lookahead == '!') {
    if (!allow_opaque)
      return false;
    lexer->result_symbol = CUSTOM_BODY_OPAQUE_BRACE_GROUP;
    return scan_opaque_brace_tail(lexer, 1);
  }

  if (lexer->lookahead != '^') {
    bool line_start = false;
    if (!allow_unclosed || !is_fallback_brace_lead(lexer, &line_start))
      return false;
    bool closed = scan_fallback_brace_tail(lexer, line_start, false, NULL);
    if (closed) return false;
    lexer->result_symbol = CUSTOM_BODY_UNCLOSED_BRACE_OPEN;
    return true;
  }
  if (!allow_opaque)
    return false;
  lexer->result_symbol = CUSTOM_BODY_OPAQUE_BRACE_GROUP;

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
      at_block_label_tail(lexer, &brace_depth, NULL);
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

static BlockLabelTailResult
at_block_label_tail(TSLexer *lexer, int *brace_depth, bool *line_start) {
  bool has_outer_brace = *brace_depth > 0;
  if (!(line_start ? skip_payload_extras(lexer, line_start)
                   : skip_label_extras(lexer))) {
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

  if (!(line_start ? skip_payload_extras(lexer, line_start) : skip_label_extras(lexer))) {
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
static bool scan_op_result_sigil(TSLexer *lexer, bool mark, bool *line_start) {
  lexer->advance(lexer, false);
  if (mark)
    lexer->mark_end(lexer);
  if (!scan_suffix_id(lexer)) {
    return false;
  }

  for (;;) {
    if (!(line_start ? skip_payload_extras(lexer, line_start)
                     : skip_label_extras(lexer))) {
      return false;
    }
    if (lexer->lookahead == '=') {
      lexer->advance(lexer, false);
      if (!(line_start ? skip_payload_extras(lexer, line_start)
                       : skip_label_extras(lexer))) {
        return false;
      }
      return is_operation_name_start(lexer->lookahead);
    }
    if (lexer->lookahead != ',') {
      return false;
    }
    lexer->advance(lexer, false);
    if (!(line_start ? skip_payload_extras(lexer, line_start)
                     : skip_label_extras(lexer))) {
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
static bool scan_generic_op_quote(TSLexer *lexer, bool mark, int *parens) {
  lexer->advance(lexer, false);
  if (mark)
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
  if (parens)
    (*parens)++;
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
  if (parens)
    (*parens)--;
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
  // A captured malformed prefix may include the sibling's indentation. In
  // recovery, the ordinary boundary probes must also work at that column.
  bool recovering = valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_PAYLOAD] &&
                    valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_OPEN];

  // The recovery lexer does not recognize arbitrary dotted names internally.
  // Supply the same token in recovery so a missing payload close can be
  // inserted before the complete sibling name, instead of deleting its
  // characters.
  if (valid_symbols[RECOVERY_DOTTED_OP_NAME] &&
      valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_PAYLOAD] &&
      valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_OPEN] &&
      ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
       (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
       lexer->lookahead == '_')) {
    char word[32];
    unsigned length = 0;
    while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
           (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
           is_digit(lexer->lookahead) || lexer->lookahead == '_' ||
           lexer->lookahead == '$') {
      if (length < sizeof(word) - 1)
        word[length++] = (char)lexer->lookahead;
      lexer->advance(lexer, false);
    }
    if (lexer->lookahead != '.')
      return false;
    if (length < sizeof(word) - 1)
      word[length++] = '.';
    lexer->advance(lexer, false);
    if (!((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
          (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
          lexer->lookahead == '_'))
      return false;
    do {
      if (length < sizeof(word) - 1)
        word[length++] = (char)lexer->lookahead;
      lexer->advance(lexer, false);
    } while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
             (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
             is_digit(lexer->lookahead) || lexer->lookahead == '_' ||
             lexer->lookahead == '$' || lexer->lookahead == '.');
    word[length] = '\0';
    if (strcmp(word, "func.func") == 0 || strcmp(word, "llvm.func") == 0 ||
        strcmp(word, "builtin.module") == 0 ||
        strcmp(word, "affine.for") == 0 ||
        strcmp(word, "pdl_interp.record_match") == 0)
      return false;
    lexer->mark_end(lexer);
    lexer->result_symbol = RECOVERY_DOTTED_OP_NAME;
    return true;
  }

  if (valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_PAYLOAD] &&
      !valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_OPEN]) {
    bool has_payload = false;
    scan_fallback_brace_tail(lexer, at_line_start, true, &has_payload);
    if (!has_payload)
      return false;
    lexer->result_symbol = CUSTOM_BODY_UNCLOSED_BRACE_PAYLOAD;
    return true;
  }

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

  if ((valid_symbols[CUSTOM_BODY_OPAQUE_BRACE_GROUP] ||
       valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_OPEN]) &&
      lexer->lookahead == '{') {
    return scan_custom_brace_group(
        lexer, valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_OPEN],
        valid_symbols[CUSTOM_BODY_OPAQUE_BRACE_GROUP]);
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
    if (valid_symbols[OP_RESULT_SIGIL] && (at_line_start || recovering) &&
        scan_op_result_sigil(lexer, true, NULL)) {
      lexer->result_symbol = OP_RESULT_SIGIL;
      return true;
    }
    return false;
  }

  if (lexer->lookahead == '"') {
    if (valid_symbols[GENERIC_OP_QUOTE] && (at_line_start || recovering) &&
        scan_generic_op_quote(lexer, true, NULL)) {
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
      at_block_label_tail(lexer, &brace_depth, NULL);
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
