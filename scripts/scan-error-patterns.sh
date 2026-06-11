#!/usr/bin/env bash
# scan-error-patterns.sh — Scan upstream MLIR tests for tree-sitter parse errors.
#
# Usage:
#   ./scripts/scan-error-patterns.sh [OPTIONS] [LLVM_PROJECT_DIR]
#
# If no directory is given, uses $LLVM_PROJECT_DIR or defaults to ../llvm-project.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/scan-error-patterns.sh [OPTIONS] [LLVM_PROJECT_DIR]

Options:
  --limit N     Show at most N detailed failures per category (default: 80).
                Use --limit 0 to show all detailed failures.
  --fail-on-valid-like
                Exit non-zero if any valid-like files fail to parse.
  -h, --help    Show this help.

The scan covers:
  mlir/test/IR/**/*.mlir
  mlir/test/Dialect/**/*.mlir

It clusters the first reported ERROR/MISSING per failed file. This keeps the
report focused on root parse breakages instead of cascaded recovery errors.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

LLVM_ARG=""
DETAIL_LIMIT="${SCAN_ERROR_LIMIT:-80}"
FAIL_ON_VALID_LIKE=0
IS_MSYS=0

die() {
  echo "Error: $*" >&2
  exit 1
}

usage_error() {
  echo "Error: $*" >&2
  usage >&2
  exit 2
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --limit)
        if [ "$#" -lt 2 ]; then
          usage_error "--limit requires a number"
        fi
        DETAIL_LIMIT="$2"
        shift 2
        ;;
      --limit=*)
        DETAIL_LIMIT="${1#--limit=}"
        shift
        ;;
      --fail-on-valid-like)
        FAIL_ON_VALID_LIKE=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      -*)
        usage_error "unknown option: $1"
        ;;
      *)
        if [ -n "$LLVM_ARG" ]; then
          usage_error "multiple llvm-project directories provided"
        fi
        LLVM_ARG="$1"
        shift
        ;;
    esac
  done

  case "$DETAIL_LIMIT" in
    ''|*[!0-9]*)
      usage_error "--limit must be a non-negative integer"
      ;;
  esac
}

line_count() {
  wc -l < "$1" | tr -d ' '
}

resolve_llvm_project() {
  local requested
  local hint

  requested="${LLVM_ARG:-${LLVM_PROJECT_DIR:-$PROJECT_DIR/../llvm-project}}"
  hint="${LLVM_ARG:-${LLVM_PROJECT_DIR:-../llvm-project}}"

  LLVM_DIR="$(cd "$requested" 2>/dev/null && pwd)" || \
    die "llvm-project directory not found at: $hint"

  MLIR_TEST_DIR="$LLVM_DIR/mlir/test"
  if [ ! -d "$MLIR_TEST_DIR/IR" ] || [ ! -d "$MLIR_TEST_DIR/Dialect" ]; then
    die "$MLIR_TEST_DIR does not contain mlir/test/IR and mlir/test/Dialect"
  fi
}

require_tools() {
  command -v npx >/dev/null 2>&1 || die "npx is required to run tree-sitter parse"
}

init_temp_files() {
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tree-sitter-mlir-scan.XXXXXX")"
  trap 'rm -rf "$TMP_DIR"' EXIT

  PATHS_FILE="$TMP_DIR/paths.txt"
  PATHS_SHELL_FILE="$TMP_DIR/paths-shell.txt"
  PARSER_LIB="$TMP_DIR/mlir.dylib"
  STAT_FILE="$TMP_DIR/parse-stat.txt"
  RECORDS_FILE="$TMP_DIR/records.tsv"
  : > "$RECORDS_FILE"
}

detect_path_mode() {
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*)
      command -v cygpath >/dev/null 2>&1 && IS_MSYS=1
      ;;
  esac
}

to_shell_path() {
  if [ "$IS_MSYS" -eq 1 ]; then
    cygpath -u "$1"
  else
    printf '%s\n' "$1"
  fi
}

prepare_paths() {
  find "$MLIR_TEST_DIR/IR" "$MLIR_TEST_DIR/Dialect" -type f -name '*.mlir' \
    | LC_ALL=C sort > "$PATHS_SHELL_FILE"

  if [ "$IS_MSYS" -eq 1 ]; then
    cygpath -w -f "$PATHS_SHELL_FILE" > "$PATHS_FILE"
  else
    cp "$PATHS_SHELL_FILE" "$PATHS_FILE"
  fi

  TOTAL_FILES="$(line_count "$PATHS_SHELL_FILE")"

  if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "No .mlir files found under $MLIR_TEST_DIR/IR or $MLIR_TEST_DIR/Dialect"
    exit 0
  fi
}

source_commit() {
  if git -C "$LLVM_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    git -C "$LLVM_DIR" rev-parse --short HEAD
  else
    echo "unknown"
  fi
}

print_header() {
  printf 'Scanning MLIR parse errors\n'
  printf '  llvm-project: %s\n' "$LLVM_DIR"
  printf '  source commit: %s\n' "$(source_commit)"
  printf '  files: %s\n' "$TOTAL_FILES"
  printf '  scanned_at: %s\n\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}

run_tree_sitter_parse() {
  npx tree-sitter build -o "$PARSER_LIB" "$PROJECT_DIR" >/dev/null

  if npx tree-sitter parse --quiet --stat --lib-path "$PARSER_LIB" \
    --lang-name mlir --paths "$PATHS_FILE" > "$STAT_FILE" 2>&1; then
    PARSE_STATUS=0
  else
    PARSE_STATUS="$?"
  fi
}

is_invalid_like() {
  local rel="$1"
  local lower
  lower="$(basename "$rel" | tr '[:upper:]' '[:lower:]')"

  case "$lower" in
    *invalid*|*error*|*unsupported*|*reject*|*crash*|*fail*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

has_expected_diagnostic_near() {
  local file="$1"
  local line_no="$2"
  local start
  local end

  # MLIR pins a diagnostic to its source line with `@below` (annotation on the
  # line above the error) or `@above` (annotation on the line below). Scan a
  # symmetric window so both styles, plus same-line annotations, are caught.
  start=$((line_no - 2))
  end=$((line_no + 2))
  if [ "$start" -lt 1 ]; then
    start=1
  fi

  sed -n "${start},${end}p" "$file" \
    | grep -Eq 'expected-(error|warning|remark)|verify-diagnostics'
}

anchor_at() {
  local text="$1"
  local col="$2"
  local tail

  if [ "$col" -ge "${#text}" ]; then
    echo "<eol>"
    return
  fi

  tail="${text:$col}"
  tail="$(printf '%s' "$tail" | sed -E 's/^[[:space:]]+//')"

  if [ -z "$tail" ]; then
    echo "<eol>"
  elif [[ "$tail" =~ ^[A-Za-z_.$][A-Za-z0-9_.$-]* ]]; then
    echo "${BASH_REMATCH[0]}"
  elif [[ "$tail" =~ ^[0-9]+ ]]; then
    echo "${BASH_REMATCH[0]}"
  else
    echo "${tail:0:1}"
  fi
}

normalize_line() {
  sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//'
}

record_parse_failures() {
  local parse_line
  local file
  local diag
  local missing_token
  local row
  local col
  local line_no
  local rel
  local category
  local raw_snippet
  local snippet
  local anchor

  while IFS= read -r parse_line; do
    case "$parse_line" in
      *$'\t'Parse:*$'\t'*\(ERROR*|*$'\t'Parse:*$'\t'*\(MISSING*)
        ;;
      *)
        continue
        ;;
    esac

    file="${parse_line%%$'\t'*}"
    file="$(printf '%s' "$file" | sed -E 's/[[:space:]]+$//')"
    file="$(to_shell_path "$file")"
    diag="${parse_line##*$'\t'}"

    missing_token=""
    if [[ "$diag" == \(MISSING* ]]; then
      if [[ "$diag" =~ ^\(MISSING[[:space:]]+\"([^\"]*)\" ]]; then
        missing_token="${BASH_REMATCH[1]}"
      fi
    fi

    row="0"
    col="0"
    if [[ "$diag" =~ \[([0-9]+),[[:space:]]*([0-9]+)\] ]]; then
      row="${BASH_REMATCH[1]}"
      col="${BASH_REMATCH[2]}"
    fi
    line_no=$((row + 1))

    rel="${file#"$MLIR_TEST_DIR/"}"
    category="valid-like"
    if is_invalid_like "$rel" || has_expected_diagnostic_near "$file" "$line_no"; then
      category="invalid-like"
    fi

    raw_snippet="$(sed -n "${line_no}p" "$file" | tr '\000\t' '  ')"
    snippet="$(printf '%s' "$raw_snippet" | normalize_line)"

    if [ -n "$missing_token" ]; then
      anchor="missing:$missing_token"
    else
      anchor="$(anchor_at "$raw_snippet" "$col")"
    fi

    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$category" "$rel" "$diag" "$line_no" "$col" "$anchor" "$snippet" \
      >> "$RECORDS_FILE"
  done < "$STAT_FILE"

  FAILED_FILES="$(line_count "$RECORDS_FILE")"

  if [ "$PARSE_STATUS" -ne 0 ] && [ "$FAILED_FILES" -eq 0 ]; then
    echo "tree-sitter parse failed, but no parse diagnostics were recognized:" >&2
    sed -n '1,80p' "$STAT_FILE" >&2
    exit "$PARSE_STATUS"
  fi
}

count_category() {
  awk -F '\t' -v category="$1" '$1 == category { count++ } END { print count + 0 }' "$RECORDS_FILE"
}

print_patterns() {
  local category="$1"
  local count

  count="$(count_category "$category")"
  echo "${category} pattern summary (${count} failed files)"

  if [ "$count" -eq 0 ]; then
    echo "  none"
    return
  fi

  awk -F '\t' -v category="$category" '
    $1 == category {
      kind = "ERROR"
      if ($3 ~ /^\(MISSING/) {
        kind = "MISSING"
      }
      key = kind " near `" $6 "`"
      counts[key]++
    }
    END {
      for (key in counts) {
        print counts[key] "\t" key
      }
    }
  ' "$RECORDS_FILE" | LC_ALL=C sort -rn | sed 's/^/  /'
}

print_details() {
  local category="$1"
  local count

  count="$(count_category "$category")"
  echo "${category} details"

  if [ "$count" -eq 0 ]; then
    echo "  none"
    return
  fi

  awk -F '\t' -v category="$category" -v limit="$DETAIL_LIMIT" '
    $1 == category {
      total++
      if (limit == 0 || shown < limit) {
        shown++
        printf "  %3d. %s:%s:%s %s near `%s`\n", shown, $2, $4, $5, $3, $6
        printf "       %s\n", $7
      }
    }
    END {
      if (limit > 0 && total > limit) {
        printf "       ... %d more omitted; rerun with --limit 0 to show all\n", total - limit
      }
    }
  ' "$RECORDS_FILE"
}

summarize_records() {
  VALID_LIKE_FAILED="$(count_category valid-like)"
  INVALID_LIKE_FAILED="$(count_category invalid-like)"
  SUCCESSFUL_FILES=$((TOTAL_FILES - FAILED_FILES))
}

print_report() {
  echo "Summary"
  echo "  total files: $TOTAL_FILES"
  echo "  successful files: $SUCCESSFUL_FILES"
  echo "  failed files: $FAILED_FILES"
  echo "  valid-like failed files: $VALID_LIKE_FAILED"
  echo "  invalid-like failed files: $INVALID_LIKE_FAILED"
  echo ""

  print_patterns valid-like
  echo ""
  print_patterns invalid-like
  echo ""
  print_details valid-like
  echo ""
  print_details invalid-like
}

enforce_valid_like_gate() {
  [ "$FAIL_ON_VALID_LIKE" -eq 1 ] || return
  [ "$VALID_LIKE_FAILED" -eq 0 ] && return

  echo ""
  echo "valid-like parse gate failed: $VALID_LIKE_FAILED file(s)"
  exit 1
}

main() {
  parse_args "$@"
  resolve_llvm_project
  require_tools
  init_temp_files
  detect_path_mode
  prepare_paths
  print_header
  run_tree_sitter_parse
  record_parse_failures
  summarize_records
  print_report
  enforce_valid_like_gate
}

main "$@"
