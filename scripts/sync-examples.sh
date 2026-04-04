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

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
total_files=$(find "$EXAMPLES_DIR" -name '*.mlir' | wc -l | tr -d ' ')
total_lines=$(find "$EXAMPLES_DIR" -name '*.mlir' -exec cat {} + | wc -l | tr -d ' ')
echo "═══════════════════════════════════════════"
echo "  Total: $total_files files, $total_lines lines"
echo "═══════════════════════════════════════════"
