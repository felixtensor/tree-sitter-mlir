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

while [ "$#" -gt 0 ]; do
  case "$1" in
    --limit)
      if [ "$#" -lt 2 ]; then
        echo "Error: --limit requires a number" >&2
        exit 2
      fi
      DETAIL_LIMIT="$2"
      shift 2
      ;;
    --limit=*)
      DETAIL_LIMIT="${1#--limit=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [ -n "$LLVM_ARG" ]; then
        echo "Error: multiple llvm-project directories provided" >&2
        usage >&2
        exit 2
      fi
      LLVM_ARG="$1"
      shift
      ;;
  esac
done

case "$DETAIL_LIMIT" in
  ''|*[!0-9]*)
    echo "Error: --limit must be a non-negative integer" >&2
    exit 2
    ;;
esac

LLVM_DIR="${LLVM_ARG:-${LLVM_PROJECT_DIR:-$PROJECT_DIR/../llvm-project}}"
LLVM_DIR="$(cd "$LLVM_DIR" 2>/dev/null && pwd)" || {
  echo "Error: llvm-project directory not found at: ${LLVM_ARG:-${LLVM_PROJECT_DIR:-../llvm-project}}" >&2
  exit 1
}

MLIR_TEST_DIR="$LLVM_DIR/mlir/test"
if [ ! -d "$MLIR_TEST_DIR/IR" ] || [ ! -d "$MLIR_TEST_DIR/Dialect" ]; then
  echo "Error: $MLIR_TEST_DIR does not contain mlir/test/IR and mlir/test/Dialect" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required to run tree-sitter parse" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tree-sitter-mlir-scan.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

PATHS_FILE="$TMP_DIR/paths.txt"
PATHS_SHELL_FILE="$TMP_DIR/paths-shell.txt"
PARSER_LIB="$TMP_DIR/mlir.dylib"
STAT_FILE="$TMP_DIR/parse-stat.txt"
RECORDS_FILE="$TMP_DIR/records.tsv"
: > "$RECORDS_FILE"

IS_MSYS=0
case "$(uname -s 2>/dev/null || true)" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v cygpath >/dev/null 2>&1; then
      IS_MSYS=1
    fi
    ;;
esac

to_shell_path() {
  if [ "$IS_MSYS" -eq 1 ]; then
    cygpath -u "$1"
  else
    printf '%s\n' "$1"
  fi
}

find "$MLIR_TEST_DIR/IR" "$MLIR_TEST_DIR/Dialect" -type f -name '*.mlir' \
  | LC_ALL=C sort > "$PATHS_SHELL_FILE"

if [ "$IS_MSYS" -eq 1 ]; then
  cygpath -w -f "$PATHS_SHELL_FILE" > "$PATHS_FILE"
else
  cp "$PATHS_SHELL_FILE" "$PATHS_FILE"
fi

TOTAL_FILES="$(wc -l < "$PATHS_SHELL_FILE" | tr -d ' ')"

if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "No .mlir files found under $MLIR_TEST_DIR/IR or $MLIR_TEST_DIR/Dialect"
  exit 0
fi

if git -C "$LLVM_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  COMMIT_SHA="$(git -C "$LLVM_DIR" rev-parse --short HEAD)"
else
  COMMIT_SHA="unknown"
fi

echo "Scanning MLIR parse errors"
echo "  llvm-project: $LLVM_DIR"
echo "  source commit: $COMMIT_SHA"
echo "  files: $TOTAL_FILES"
echo "  scanned_at: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo ""

npx tree-sitter build -o "$PARSER_LIB" "$PROJECT_DIR" >/dev/null

set +e
npx tree-sitter parse --quiet --stat --lib-path "$PARSER_LIB" --lang-name mlir \
  --paths "$PATHS_FILE" > "$STAT_FILE" 2>&1
PARSE_STATUS="$?"
set -e

is_invalid_like() {
  local rel="$1"
  local base lower
  base="$(basename "$rel")"
  lower="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')"

  case "$lower" in
    *invalid*|*error*|*unsupported*|*reject*|*crash*|*fail*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
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

  rel="${file#"$MLIR_TEST_DIR/"}"
  if is_invalid_like "$rel"; then
    category="invalid-like"
  else
    category="valid-like"
  fi

  kind="ERROR"
  missing_token=""
  if [[ "$diag" == \(MISSING* ]]; then
    kind="MISSING"
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

  raw_snippet="$(sed -n "${line_no}p" "$file" | tr '\000\t' '  ')"
  snippet="$(printf '%s' "$raw_snippet" | normalize_line)"

  if [ "$kind" = "MISSING" ] && [ -n "$missing_token" ]; then
    anchor="missing:$missing_token"
  else
    anchor="$(anchor_at "$raw_snippet" "$col")"
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$category" "$rel" "$diag" "$line_no" "$col" "$anchor" "$snippet" \
    >> "$RECORDS_FILE"
done < "$STAT_FILE"

FAILED_FILES="$(wc -l < "$RECORDS_FILE" | tr -d ' ')"

if [ "$PARSE_STATUS" -ne 0 ] && [ "$FAILED_FILES" -eq 0 ]; then
  echo "tree-sitter parse failed, but no parse diagnostics were recognized:" >&2
  sed -n '1,80p' "$STAT_FILE" >&2
  exit "$PARSE_STATUS"
fi

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

VALID_LIKE_FAILED="$(count_category valid-like)"
INVALID_LIKE_FAILED="$(count_category invalid-like)"
SUCCESSFUL_FILES=$((TOTAL_FILES - FAILED_FILES))

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
