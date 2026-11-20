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
  CUSTOM_BODY_UNCLOSED_BRACE_PREFIX,
  RECOVERY_DOTTED_OP_NAME,
  ERROR_SENTINEL,
  CUSTOM_BODY_MODULE_KEYWORD,
  PRETTY_DIALECT_FALLBACK,
};

void *tree_sitter_mlir_external_scanner_create(void) { return NULL; }

void tree_sitter_mlir_external_scanner_destroy(void *payload) { (void)payload; }

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

typedef enum {
  SUFFIX_ID_INVALID,
  SUFFIX_ID_COMPLETE,
  SUFFIX_ID_COLON,
  SUFFIX_ID_HASH,
} SuffixIdResult;

// Scan a suffix-id (calling `mark_end` only when `mark` is set). A trailing
// non-numeric `:`/`#` is consumed as lookahead; continuing callers handle it.
static SuffixIdResult scan_suffix_id(TSLexer *lexer, bool mark) {
  if (is_digit(lexer->lookahead)) {
    do {
      lexer->advance(lexer, false);
    } while (is_digit(lexer->lookahead));
  } else if (is_identifier_start(lexer->lookahead)) {
    do {
      lexer->advance(lexer, false);
    } while (is_identifier_char(lexer->lookahead));
  } else {
    return SUFFIX_ID_INVALID;
  }
  if (mark)
    lexer->mark_end(lexer);

  if (lexer->lookahead == ':' || lexer->lookahead == '#') {
    int32_t separator = lexer->lookahead;
    lexer->advance(lexer, false);
    if (!is_digit(lexer->lookahead)) {
      return separator == ':' ? SUFFIX_ID_COLON : SUFFIX_ID_HASH;
    }
    do {
      lexer->advance(lexer, false);
    } while (is_digit(lexer->lookahead));
    if (mark)
      lexer->mark_end(lexer);
  }
  return SUFFIX_ID_COMPLETE;
}

static SuffixIdResult scan_caret_id(TSLexer *lexer, bool mark) {
  lexer->advance(lexer, false);
  return scan_suffix_id(lexer, mark);
}

// Positioned after `#`/`!`; preserve any attached `<...>` opener in `angles`.
static void scan_dialect_envelope_tail(TSLexer *lexer, int *angles) {
  if (!is_identifier_start(lexer->lookahead))
    return;
  do {
    lexer->advance(lexer, false);
  } while (is_identifier_char(lexer->lookahead));
  if (lexer->lookahead == '<') {
    (*angles)++;
    lexer->advance(lexer, false);
  }
}

// Internal probes cannot rewind; track an attached dialect envelope if `#` was
// consumed.
static bool scan_probe_suffix_id(TSLexer *lexer, bool *line_start,
                                 int *angles) {
  if (line_start)
    *line_start = false;
  SuffixIdResult result = scan_suffix_id(lexer, false);
  if (result == SUFFIX_ID_HASH && angles)
    scan_dialect_envelope_tail(lexer, angles);
  return result == SUFFIX_ID_COMPLETE;
}

// Start of a custom op name or generic op string literal.
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

// At `x`: consume `x` and require a following digit or `?` (distinguishes
// dimension separators like `16x16` / `16x?` from bare `x`).
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

// Skip whitespace and `//` comments; a lone `/` is consumed and reported via
// `EXTRAS_SINGLE_SLASH` so opaque-body callers can keep scanning past it.
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

static BlockLabelTailResult
at_block_label_tail(TSLexer *lexer, int *brace_depth, bool *line_start);

// After `{` with an already-verified opaque lead: consume one balanced `{...}`
// group (ignoring strings and line comments). Returns false on EOF so unclosed
// groups fall back to grammar recovery.
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

static bool scan_op_result_sigil(TSLexer *lexer, bool mark, bool *line_start,
                                 int *angles);
static bool scan_generic_op_quote(TSLexer *lexer, bool mark, bool *line_start,
                                  int *parens, int *angles);

static bool skip_payload_extras(TSLexer *lexer, bool *line_start) {
  for (;;) {
    *line_start |= skip_space(lexer, false);
    CommentScanResult comment = skip_comment(lexer);
    if (comment == COMMENT_NOT_FOUND)
      return true;
    if (comment == SINGLE_SLASH) {
      *line_start = false;
      return false;
    }
  }
}

// Read an identifier using the operation-boundary alphabet.
static bool scan_body_word(TSLexer *lexer, char word[32]) {
  unsigned length = 0;
  bool dotted = false;
  while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
         (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
         is_digit(lexer->lookahead) || lexer->lookahead == '_' ||
         lexer->lookahead == '$' || lexer->lookahead == '.') {
    dotted |= lexer->lookahead == '.';
    if (length < 31)
      word[length++] = (char)lexer->lookahead;
    lexer->advance(lexer, false);
  }
  word[length] = '\0';
  return dotted;
}

static bool is_boundary_word(const char *word, bool dotted) {
  return dotted || strcmp(word, "return") == 0 || strcmp(word, "call") == 0 ||
         strcmp(word, "call_indirect") == 0 || strcmp(word, "constant") == 0 ||
         strcmp(word, "unrealized_conversion_cast") == 0 ||
         strcmp(word, "module") == 0;
}

typedef enum {
  MODULE_SYMBOL_INVALID,
  MODULE_SYMBOL_READY,
  MODULE_SYMBOL_BODY,
} ModuleSymbolResult;

// No `mark_end`: callers own their token boundaries. `MODULE_SYMBOL_BODY`
// means a consumed suffix or lone `/` already ruled out a module header.
static ModuleSymbolResult
scan_module_symbol_tail(TSLexer *lexer, bool *line_start, int *angles) {
  for (;;) {
    if (lexer->lookahead != '@')
      return MODULE_SYMBOL_INVALID;
    lexer->advance(lexer, false);
    *line_start = false;
    if (lexer->lookahead == '"') {
      lexer->advance(lexer, false);
      while (lexer->lookahead != '"') {
        if (lexer->lookahead == '\0' || lexer->lookahead == '\n' ||
            lexer->lookahead == '\r' || lexer->lookahead == '\f' ||
            lexer->lookahead == '\v')
          return MODULE_SYMBOL_INVALID;
        if (lexer->lookahead == '\\') {
          lexer->advance(lexer, false);
          if (lexer->lookahead == '\0' || lexer->lookahead == '\n' ||
              lexer->lookahead == '\r')
            return MODULE_SYMBOL_INVALID;
        }
        lexer->advance(lexer, false);
      }
      lexer->advance(lexer, false);
    } else {
      SuffixIdResult suffix = scan_suffix_id(lexer, false);
      if (suffix == SUFFIX_ID_INVALID)
        return MODULE_SYMBOL_INVALID;
      if (suffix == SUFFIX_ID_HASH) {
        if (angles)
          scan_dialect_envelope_tail(lexer, angles);
        return MODULE_SYMBOL_BODY;
      }
      if (suffix == SUFFIX_ID_COLON) {
        if (lexer->lookahead != ':')
          return MODULE_SYMBOL_BODY; // Single `:` cannot continue a header.
        lexer->advance(lexer, false);
        if (!skip_payload_extras(lexer, line_start))
          return MODULE_SYMBOL_INVALID;
        continue;
      }
    }
    if (!skip_payload_extras(lexer, line_start))
      return MODULE_SYMBOL_BODY; // Lone `/` cannot continue a header.
    if (lexer->lookahead != ':')
      break;
    lexer->advance(lexer, false);
    if (lexer->lookahead != ':')
      return MODULE_SYMBOL_BODY;
    lexer->advance(lexer, false);
    if (!skip_payload_extras(lexer, line_start))
      return MODULE_SYMBOL_INVALID;
  }

  return MODULE_SYMBOL_READY;
}

// Emit only `module`, leaving `@sym` / `(@sym)` to the grammar; reject when
// followed by `{`, `<`, or `attributes` (real `module_operation` header).
static bool scan_module_payload_keyword(TSLexer *lexer) {
  const char *keyword = "module";
  for (unsigned i = 0; keyword[i]; i++) {
    if (lexer->lookahead != keyword[i])
      return false;
    lexer->advance(lexer, false);
  }
  if (is_identifier_char(lexer->lookahead))
    return false;
  lexer->mark_end(lexer);
  bool line_start = false;
  if (!skip_payload_extras(lexer, &line_start))
    return false;
  if (lexer->lookahead == '(')
    return true;
  ModuleSymbolResult result = scan_module_symbol_tail(lexer, &line_start, NULL);
  if (result != MODULE_SYMBOL_READY)
    return result == MODULE_SYMBOL_BODY;
  if (lexer->lookahead == '{' || lexer->lookahead == '<')
    return false;
  char word[32];
  scan_body_word(lexer, word);
  return strcmp(word, "attributes") != 0 ||
         is_identifier_char(lexer->lookahead);
}

// After `<`: distinguish OpenMP `<-` (returns false) from angle group /
// negative literal.
static bool scan_angle_tail(TSLexer *lexer, bool *line_start) {
  if (!skip_payload_extras(lexer, line_start) || lexer->lookahead != '-')
    return true;
  lexer->advance(lexer, false);
  *line_start = false;
  return is_digit(lexer->lookahead);
}

static bool is_fallback_brace_lead(TSLexer *lexer, bool *line_start) {
  // Bare `key =` may enter enum fallback; balanced dicts still stay in grammar.
  if ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
      (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
      lexer->lookahead == '_') {
    do {
      lexer->advance(lexer, false);
    } while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
             (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
             is_digit(lexer->lookahead) || lexer->lookahead == '_' ||
             lexer->lookahead == '$' || lexer->lookahead == '.');
    lexer->mark_end(lexer);
    *line_start = false;
    if (!skip_payload_extras(lexer, line_start) || lexer->lookahead != '=')
      return false;
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    *line_start = false;
    return true;
  }
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
    lexer->mark_end(lexer);
    *line_start = false;
    if (!skip_payload_extras(lexer, line_start))
      return true;
    return lexer->lookahead != '=' && lexer->lookahead != ',' &&
           lexer->lookahead != '}' && lexer->lookahead != '(';
  }
  if (lexer->lookahead == '%') {
    lexer->advance(lexer, false);
    if (scan_suffix_id(lexer, false) != SUFFIX_ID_COMPLETE)
      return false;
    lexer->mark_end(lexer);
    *line_start = false;
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

// Verify whether a fallback brace closes before any direct line-start op/block
// boundary (ignoring nested groups, strings, comments). Returns true to decline
// the prefix token so balanced payloads keep full grammar CST nodes.
static bool scan_fallback_brace_tail(TSLexer *lexer, bool line_start) {
  int braces = 1, parens = 0, brackets = 0, angles = 0;
  bool in_string = false;
  while (lexer->lookahead != '\0') {
    // Keep boundary-leading whitespace outside the prefix so following scanners
    // see newlines.
    if (!line_start)
      lexer->mark_end(lexer);
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
      if (scan_op_result_sigil(lexer, false, &line_start, &angles))
        return false;
      continue;
    }
    if (direct_line && c == '"') {
      line_start = false;
      if (scan_generic_op_quote(lexer, false, &line_start, &parens, &angles))
        return false;
      continue;
    }
    if (direct_line && c == '^') {
      line_start = false;
      SuffixIdResult id = scan_caret_id(lexer, false);
      if (id == SUFFIX_ID_COLON)
        return false;
      if (id != SUFFIX_ID_COMPLETE) {
        if (id == SUFFIX_ID_HASH)
          scan_dialect_envelope_tail(lexer, &angles);
        continue;
      }
      int nested_braces = 0;
      if (at_block_label_tail(lexer, &nested_braces, &line_start) ==
          BLOCK_LABEL_TAIL_FOUND)
        return false;
      continue;
    }
    if (line_start && braces == 1 && parens == 0 && brackets == 0 &&
        angles == 0 &&
        ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_')) {
      bool after_module_symbol = false;
      bool keep_line_start = false;
      for (;;) {
        char word[32];
        bool dotted = scan_body_word(lexer, word);
        if (after_module_symbol && strcmp(word, "attributes") == 0 &&
            !is_identifier_char(lexer->lookahead))
          return false;
        // Preserve line-start status after a module-symbol probe; don't
        // reclassify inline words.
        if (!line_start)
          break;
        after_module_symbol = false;
        if (strcmp(word, "module") == 0) {
          line_start = false;
          if (!skip_payload_extras(lexer, &line_start))
            return false;
          if (lexer->lookahead == '(')
            break;
          if (lexer->lookahead == '@') {
            ModuleSymbolResult result =
                scan_module_symbol_tail(lexer, &line_start, &angles);
            if (result == MODULE_SYMBOL_INVALID)
              return false;
            if (result == MODULE_SYMBOL_BODY)
              break;
            if (lexer->lookahead == '{' || lexer->lookahead == '<')
              return false;
            // Re-check next word: `attributes` is a header, dotted/listed names
            // are boundaries.
            if ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
                (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
                lexer->lookahead == '_') {
              after_module_symbol = true;
              continue;
            }
            keep_line_start = true;
            break;
          }
        }
        if (is_boundary_word(word, dotted)) {
          // `=` indicates assignment rather than a new op; `module` also
          // excludes `:`.
          bool next_line = false;
          if (!skip_payload_extras(lexer, &next_line) ||
              (lexer->lookahead != '=' &&
               !(strcmp(word, "module") == 0 && lexer->lookahead == ':')))
            return false;
        }
        break;
      }
      if (!keep_line_start)
        line_start = false;
      continue;
    }
    line_start = false;
    // Attached dialect envelopes own their `<` even when payload begins with
    // `-`.
    if (c == '#' || c == '!') {
      lexer->advance(lexer, false);
      scan_dialect_envelope_tail(lexer, &angles);
      continue;
    }
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
      if (c == '<') {
        if (scan_angle_tail(lexer, &line_start))
          angles++;
      } else if (lexer->lookahead == '>') {
        lexer->advance(lexer, false);
      }
      continue;
    } else if (c == '>' && angles > 0)
      angles--;
    lexer->advance(lexer, false);
  }
  lexer->mark_end(lexer);
  return false;
}

// At `{`: emit opaque group for balanced `#`/`!`/non-label `^` leads, or
// unclosed prefix for malformed fallback leads; balanced payloads stay in
// grammar.
static bool scan_custom_brace_group(TSLexer *lexer, bool allow_unclosed,
                                    bool allow_opaque) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  bool line_start = false;
  if (!skip_payload_extras(lexer, &line_start)) {
    if (!allow_unclosed)
      return false;
    lexer->mark_end(lexer);
    if (scan_fallback_brace_tail(lexer, false))
      return false;
    lexer->result_symbol = CUSTOM_BODY_UNCLOSED_BRACE_PREFIX;
    return true;
  }

  if (lexer->lookahead == '#' || lexer->lookahead == '!') {
    if (!allow_opaque)
      return false;
    lexer->result_symbol = CUSTOM_BODY_OPAQUE_BRACE_GROUP;
    return scan_opaque_brace_tail(lexer, 1);
  }

  if (lexer->lookahead != '^') {
    if (!allow_unclosed || !is_fallback_brace_lead(lexer, &line_start))
      return false;
    if (scan_fallback_brace_tail(lexer, line_start))
      return false;
    lexer->result_symbol = CUSTOM_BODY_UNCLOSED_BRACE_PREFIX;
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

  // Immediate non-numeric `:` is compact block-label syntax; consume numeric
  // suffixes first.
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

// Payload probes track line/delimiter state across failures; boundary scans
// rewind.
static bool skip_probe_extras(TSLexer *lexer, bool *line_start) {
  return line_start ? skip_payload_extras(lexer, line_start)
                    : skip_label_extras(lexer);
}

// At `#` or `!`: emit only the sigil when followed by `<alias_id> =`.
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
  if (!skip_probe_extras(lexer, line_start)) {
    return BLOCK_LABEL_TAIL_NOT_FOUND;
  }

  if (lexer->lookahead == '(') {
    int32_t depth = 1;
    lexer->advance(lexer, false);
    while (depth > 0) {
      // A lone `/` inside block-arg types (e.g. `!d.t<a/b>`) is already
      // consumed.
      (void)skip_extras(lexer);
      switch (lexer->lookahead) {
      case '\0':
        return BLOCK_LABEL_TAIL_NOT_FOUND;
      case '"':
        // Skip strings so embedded brackets or `//` do not disturb nesting.
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
        // Consume `->` as a pair so its `>` doesn't close an enclosing `<...>`.
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
    if (line_start)
      *line_start = false;
  }

  if (!skip_probe_extras(lexer, line_start)) {
    return BLOCK_LABEL_TAIL_NOT_FOUND;
  }

  return lexer->lookahead == ':' ? BLOCK_LABEL_TAIL_FOUND
                                 : BLOCK_LABEL_TAIL_NOT_FOUND;
}

// At `%`: emit only `%` when lookahead matches `%id (, %id)* = <op-name-start>`
// (distinguishes op result lists from custom-body `%i = %lb`).
static bool scan_op_result_sigil(TSLexer *lexer, bool mark, bool *line_start,
                                 int *angles) {
  lexer->advance(lexer, false);
  if (mark)
    lexer->mark_end(lexer);
  if (!scan_probe_suffix_id(lexer, line_start, angles)) {
    return false;
  }

  for (;;) {
    if (line_start)
      *line_start = false;
    if (!skip_probe_extras(lexer, line_start)) {
      return false;
    }
    if (lexer->lookahead == '=') {
      lexer->advance(lexer, false);
      if (line_start)
        *line_start = false;
      if (!skip_probe_extras(lexer, line_start)) {
        return false;
      }
      return is_operation_name_start(lexer->lookahead);
    }
    if (lexer->lookahead != ',') {
      return false;
    }
    lexer->advance(lexer, false);
    if (line_start)
      *line_start = false;
    if (!skip_probe_extras(lexer, line_start)) {
      return false;
    }
    if (lexer->lookahead != '%') {
      return false;
    }
    lexer->advance(lexer, false);
    if (!scan_probe_suffix_id(lexer, line_start, angles)) {
      return false;
    }
  }
}

// At `"`: emit only `"` when lookahead matches `"..." (%id (, %id)*)?` followed
// by a generic-op continuation (`:`, `[`, `<{`, `(`, or `{`).
static bool scan_generic_op_quote(TSLexer *lexer, bool mark, bool *line_start,
                                  int *parens, int *angles) {
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
      // Step past escaped char so `\"` does not end the string; grammar checks
      // validity.
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

  if (line_start)
    *line_start = false;
  if (!skip_probe_extras(lexer, line_start)) {
    return false;
  }
  if (lexer->lookahead != '(') {
    return false;
  }
  lexer->advance(lexer, false);
  if (parens)
    (*parens)++;
  if (line_start)
    *line_start = false;
  if (!skip_probe_extras(lexer, line_start)) {
    return false;
  }
  if (lexer->lookahead == '%') {
    for (;;) {
      lexer->advance(lexer, false);
      if (!scan_probe_suffix_id(lexer, line_start, angles)) {
        return false;
      }
      if (line_start)
        *line_start = false;
      if (!skip_probe_extras(lexer, line_start)) {
        return false;
      }
      if (lexer->lookahead != ',') {
        break;
      }
      lexer->advance(lexer, false);
      if (line_start)
        *line_start = false;
      if (!skip_probe_extras(lexer, line_start)) {
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
  if (line_start)
    *line_start = false;
  if (!skip_probe_extras(lexer, line_start)) {
    return false;
  }

  switch (lexer->lookahead) {
  case ':':
  case '[':
  case '(':
  case '{':
    return true;
  case '<': {
    lexer->advance(lexer, false);
    if (line_start)
      *line_start = false;
    if (!skip_probe_extras(lexer, line_start)) {
      // Carry consumed `<` into fallback nesting before returning.
      if (angles)
        (*angles)++;
      return false;
    }
    bool properties = lexer->lookahead == '{';
    if (angles && scan_angle_tail(lexer, line_start)) {
      (*angles)++;
    }
    return properties;
  }
  default:
    return false;
  }
}

// Single-char fallback punctuation inside `pretty_dialect_item_body`. Skips
// whitespace/NUL (`advance(..., true)`) for tight ranges; yields to grammar
// tokens.
static bool scan_pretty_dialect_fallback(TSLexer *lexer) {
  for (;;) {
    skip_space(lexer, true);
    if (!lexer->eof(lexer) && lexer->lookahead == '\0') {
      lexer->advance(lexer, true);
      continue;
    }
    break;
  }

  if (lexer->eof(lexer)) {
    return false;
  }

  int32_t c = lexer->lookahead;
  if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' ||
      is_digit(c)) {
    return false;
  }

  switch (c) {
  case '<':
  case '>':
  case ',':
  case ':':
  case '=':
  case '(':
  case ')':
  case '[':
  case ']':
  case '{':
  case '}':
  case '*':
  case '?':
  case '@':
  case '#':
  case '"':
  case '.':
    return false;
  case '/':
    lexer->advance(lexer, false);
    if (lexer->lookahead == '/') {
      return false;
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = PRETTY_DIALECT_FALLBACK;
    return true;
  case '-':
    lexer->advance(lexer, false);
    if (lexer->lookahead == '>' || is_digit(lexer->lookahead)) {
      return false;
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = PRETTY_DIALECT_FALLBACK;
    return true;
  case '+':
    lexer->advance(lexer, false);
    if (is_digit(lexer->lookahead)) {
      return false;
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = PRETTY_DIALECT_FALLBACK;
    return true;
  case '!':
    lexer->advance(lexer, false);
    if (!lexer->eof(lexer) && lexer->lookahead != '<' &&
        lexer->lookahead != '>') {
      return false;
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = PRETTY_DIALECT_FALLBACK;
    return true;
  default:
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    lexer->result_symbol = PRETTY_DIALECT_FALLBACK;
    return true;
  }
}

bool tree_sitter_mlir_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  (void)payload;

  // Snapshot before the dimension-separator probe shifts the column.
  bool at_line_start = lexer->get_column(lexer) == 0;
  bool caret_is_adjacent = lexer->lookahead == '^';

  // Only `CUSTOM_BODY_DIMENSION_SEPARATOR` starts with `x`. Return immediately
  // on a failed `x` probe so we never fall through past `x` into `^` (e.g.
  // `16x^bb0`).
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
  // Unused sentinel token is valid exclusively during tree-sitter error
  // recovery.
  bool recovering = valid_symbols[ERROR_SENTINEL];

  // No other context external token is valid alongside
  // `PRETTY_DIALECT_FALLBACK`.
  if (!recovering && valid_symbols[PRETTY_DIALECT_FALLBACK]) {
    return scan_pretty_dialect_fallback(lexer);
  }

  if (!recovering && valid_symbols[CUSTOM_BODY_MODULE_KEYWORD] &&
      lexer->lookahead == 'm') {
    if (!scan_module_payload_keyword(lexer))
      return false;
    lexer->result_symbol = CUSTOM_BODY_MODULE_KEYWORD;
    return true;
  }

  // Supply dotted op names during recovery so a missing `}` inserts before the
  // sibling op instead of deleting its characters.
  if (valid_symbols[RECOVERY_DOTTED_OP_NAME] &&
      valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_PREFIX] && recovering &&
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
       valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_PREFIX]) &&
      lexer->lookahead == '{') {
    return scan_custom_brace_group(
        lexer, valid_symbols[CUSTOM_BODY_UNCLOSED_BRACE_PREFIX] && !recovering,
        valid_symbols[CUSTOM_BODY_OPAQUE_BRACE_GROUP]);
  }

  // Allow compact `{^bb0: ...}` when adjacent (no leading extra), while keeping
  // line-start required for spaced successor syntax like `^bb0 : i32`.
  bool can_be_block_label =
      valid_symbols[BLOCK_LABEL_ID] &&
      (at_line_start || caret_is_adjacent || !valid_symbols[CARET_ID]);

  // Line-start operation boundaries (never relaxed in recovery): mid-line
  // `%i = ...` or `"name"(...)` belong to the current custom body.
  if (lexer->lookahead == '%') {
    if (valid_symbols[OP_RESULT_SIGIL] && at_line_start &&
        scan_op_result_sigil(lexer, true, NULL, NULL)) {
      lexer->result_symbol = OP_RESULT_SIGIL;
      return true;
    }
    return false;
  }

  if (lexer->lookahead == '"') {
    if (valid_symbols[GENERIC_OP_QUOTE] && at_line_start &&
        scan_generic_op_quote(lexer, true, NULL, NULL, NULL)) {
      lexer->result_symbol = GENERIC_OP_QUOTE;
      return true;
    }
    return false;
  }

  if (lexer->lookahead != '^') {
    return false;
  }

  SuffixIdResult id = scan_caret_id(lexer, true);
  if (id == SUFFIX_ID_COLON) {
    if (!can_be_block_label)
      return false;
    lexer->result_symbol = BLOCK_LABEL_ID;
    return true;
  }
  if (id != SUFFIX_ID_COMPLETE)
    return false;

  int brace_depth = 0;
  BlockLabelTailResult block_label_tail =
      at_block_label_tail(lexer, &brace_depth, NULL);
  bool is_block_label =
      can_be_block_label && block_label_tail == BLOCK_LABEL_TAIL_FOUND;
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
