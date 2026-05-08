#!/usr/bin/env bash
# sync-examples.sh — Sync MLIR test files from llvm-project into examples/
#
# Usage:
#   ./scripts/sync-examples.sh [LLVM_PROJECT_DIR]
#
# If no argument is given, uses $LLVM_PROJECT_DIR or defaults to ../llvm-project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLES_DIR="$PROJECT_DIR/examples"

LLVM_DIR="${1:-${LLVM_PROJECT_DIR:-$PROJECT_DIR/../llvm-project}}"
LLVM_DIR="$(cd "$LLVM_DIR" 2>/dev/null && pwd)" || {
  echo "Error: llvm-project directory not found at: ${1:-${LLVM_PROJECT_DIR:-../llvm-project}}"
  echo "Usage: $0 [LLVM_PROJECT_DIR]"
  exit 1
}

MLIR_TEST_DIR="$LLVM_DIR/mlir/test"

if [ ! -d "$MLIR_TEST_DIR" ]; then
  echo "Error: $MLIR_TEST_DIR does not exist. Is this a valid llvm-project checkout?"
  exit 1
fi

echo "Syncing MLIR examples from: $LLVM_DIR"
echo "Target directory: $EXAMPLES_DIR"
echo ""

# ── Helper ───────────────────────────────────────────────────────────────────
sync_dir() {
  local src="$1"
  local dst="$2"
  local count=0
  local skipped=0

  mkdir -p "$dst"

  # Remove old files in dst that no longer exist in src
  for f in "$dst"/*.mlir; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"
    if [ ! -f "$src/$basename" ]; then
      rm "$f"
    fi
  done

  for f in "$src"/*.mlir; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"

    # Skip files with "invalid" in the name
    if [[ "$basename" == *invalid* ]]; then
      skipped=$((skipped + 1))
      continue
    fi

    cp "$f" "$dst/"
    count=$((count + 1))
  done

  echo "  $count files synced, $skipped skipped (invalid)"
}

# ── Sync IR tests (from mlir/test/IR/) ───────────────────────────────────────
echo "IR (selected files):"
mkdir -p "$EXAMPLES_DIR/IR"
ir_count=0
for f in parser.mlir core-ops.mlir attribute.mlir affine-map.mlir affine-set.mlir; do
  if [ -f "$MLIR_TEST_DIR/IR/$f" ]; then
    cp "$MLIR_TEST_DIR/IR/$f" "$EXAMPLES_DIR/IR/"
    ir_count=$((ir_count + 1))
  else
    echo "  Warning: $f not found in $MLIR_TEST_DIR/IR/"
  fi
done
echo "  $ir_count files synced"

# ── Sync dialect tests ───────────────────────────────────────────────────────
DIALECTS="Builtin Func Arith SCF ControlFlow MemRef Tensor Affine Vector Linalg"

for dialect in $DIALECTS; do
  src="$MLIR_TEST_DIR/Dialect/$dialect"
  dst="$EXAMPLES_DIR/$dialect"

  if [ ! -d "$src" ]; then
    echo "$dialect: SKIPPED (directory not found)"
    continue
  fi

  echo "$dialect:"
  sync_dir "$src" "$dst"
done

# ── Record source provenance ────────────────────────────────────────────────
# Writes examples/SOURCE.md with the upstream commit SHA. Does NOT fetch from
# the upstream repository — only reads `git rev-parse HEAD` of the local
# checkout that was passed in.
SOURCE_FILE="$EXAMPLES_DIR/SOURCE.md"
SYNCED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

if git -C "$LLVM_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  COMMIT_SHA="$(git -C "$LLVM_DIR" rev-parse HEAD)"
  COMMIT_DATE="$(git -C "$LLVM_DIR" log -1 --format=%cI HEAD)"
else
  COMMIT_SHA="unknown (source is not a git checkout)"
  COMMIT_DATE="unknown"
fi

cat > "$SOURCE_FILE" <<EOF
# examples/ source

This directory is synced from a local checkout of \`llvm/llvm-project\` via
\`scripts/sync-examples.sh\`. The script does not fetch from upstream — it
only copies from the directory you point it at.

- commit:       $COMMIT_SHA
- commit_date:  $COMMIT_DATE
- synced_at:    $SYNCED_AT
EOF

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
total_files=$(find "$EXAMPLES_DIR" -name '*.mlir' | wc -l | tr -d ' ')
total_lines=$(find "$EXAMPLES_DIR" -name '*.mlir' -exec cat {} + | wc -l | tr -d ' ')
echo "═══════════════════════════════════════════"
echo "  Total: $total_files files, $total_lines lines"
echo "  Source: $COMMIT_SHA"
echo "═══════════════════════════════════════════"
