import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as benchShim from "../bench.mjs";
import { parseArgs } from "../scripts/bench/cli.mjs";
import { platformKey, upsertPlatformBaseline } from "../scripts/bench/baseline.mjs";
import {
  median,
  parseStatSummary,
  resolveTreeSitterExecutable,
} from "../scripts/bench/common.mjs";
import { MIN_PCT } from "../scripts/bench/parse-gate.mjs";
import { parseTimedFileRows } from "../scripts/bench/slow.mjs";
import {
  SCHEMA_VERSION,
  assertManifestSchema,
  diffManifests,
  splitTreesByFile,
  structuralSexp,
} from "../scripts/bench/snapshot.mjs";

describe("bench CLI surface", () => {
  test("root bench shim re-exports the stable programmatic surface", () => {
    assert.deepEqual(Object.keys(benchShim).sort(), [
      "main",
      "parseArgs",
      "parseStatSummary",
      "platformKey",
      "upsertPlatformBaseline",
    ]);
  });

  test("parseArgs recognizes slow report mode with its optional count", () => {
    const options = parseArgs(["--slow", "5", "--runs", "1", "--min-size", "2048"]);

    assert.equal(options.mode, "slow");
    assert.equal(options.slowCount, 5);
    assert.equal(options.runs, 1);
    assert.equal(options.minSizeBytes, 2048);
  });

  test("parseArgs recognizes baseline mode and output path", () => {
    const options = parseArgs([
      "--baseline",
      "--runs",
      "5",
      "--warmup",
      "2",
      "--min-size",
      "4096",
      "--output",
      "bench/custom-baseline.json",
    ]);

    assert.equal(options.mode, "baseline");
    assert.equal(options.runs, 5);
    assert.equal(options.warmupRuns, 2);
    assert.equal(options.minSizeBytes, 4096);
    assert.equal(options.baselinePath, "bench/custom-baseline.json");
  });

  test("parseArgs recognizes snapshot and verify manifest modes", () => {
    assert.equal(parseArgs(["--snapshot"]).mode, "snapshot");
    assert.equal(parseArgs(["--verify"]).mode, "verify");
  });

  test("parseArgs rejects conflicting modes and missing option values", () => {
    assert.throws(
      () => parseArgs(["--baseline", "--slow"]),
      /Conflicting bench modes/,
    );
    assert.throws(
      () => parseArgs(["--runs"]),
      /--runs requires a positive integer/,
    );
    assert.throws(
      () => parseArgs(["--output"]),
      /--output requires a path/,
    );
  });
});

describe("shared bench helpers", () => {
  test("parseStatSummary extracts parse totals and average speed", () => {
    const output =
      "Total parses: 3; successful parses: 3; failed parses: 0; success percentage: 100.00%; average speed: 12345 bytes/ms\n";

    assert.deepEqual(parseStatSummary(output), {
      totalParses: 3,
      successfulParses: 3,
      failedParses: 0,
      successPercentage: 100,
      averageSpeedBytesMs: 12345,
    });
  });

  test("median returns the middle value for odd runs and mean middle for even runs", () => {
    assert.equal(median([50, 10, 20]), 20);
    assert.equal(median([30, 10, 40, 20]), 25);
  });

  test("resolveTreeSitterExecutable points at the local tree-sitter CLI binary", () => {
    const executable = resolveTreeSitterExecutable();

    assert.match(executable, /tree-sitter(?:\.exe)?$/);
  });
});

describe("baseline helpers", () => {
  test("platformKey combines platform and arch", () => {
    assert.equal(platformKey({ platform: "win32", arch: "x64" }), "win32-x64");
    assert.equal(platformKey({ platform: "darwin", arch: "arm64" }), "darwin-arm64");
  });

  test("upsertPlatformBaseline records a platform without dropping the others", () => {
    const existing = {
      schemaVersion: 2,
      speedMetric: "ignored",
      platforms: {
        "darwin-arm64": { averageSpeedBytesMs: 12000 },
      },
    };

    const merged = upsertPlatformBaseline(existing, "win32-x64", {
      averageSpeedBytesMs: 11000,
    });

    assert.equal(merged.platforms["darwin-arm64"].averageSpeedBytesMs, 12000);
    assert.equal(merged.platforms["win32-x64"].averageSpeedBytesMs, 11000);
    assert.equal(merged.schemaVersion, 2);
  });

  test("upsertPlatformBaseline starts fresh when no prior baseline exists", () => {
    const merged = upsertPlatformBaseline(null, "win32-x64", {
      averageSpeedBytesMs: 11000,
    });

    assert.deepEqual(Object.keys(merged.platforms), ["win32-x64"]);
    assert.equal(merged.platforms["win32-x64"].averageSpeedBytesMs, 11000);
  });

  test("upsertPlatformBaseline discards an incompatible older schema", () => {
    const existing = { schemaVersion: 1, averageSpeedBytesMs: 9999 };

    const merged = upsertPlatformBaseline(existing, "win32-x64", {
      averageSpeedBytesMs: 11000,
    });

    assert.equal(merged.schemaVersion, 2);
    assert.deepEqual(Object.keys(merged.platforms), ["win32-x64"]);
  });
});

describe("parse gate", () => {
  test("requires complete examples parse success", () => {
    assert.equal(MIN_PCT, 100);
  });
});

describe("slow report helpers", () => {
  test("parseTimedFileRows extracts every per-file timing row", () => {
    const output = [
      "examples\\AMDGPU\\ops.mlir    \tParse:    5.99 ms\t  9363 bytes/ms",
      "examples\\Affine\\ops.mlir\tParse:   14.50 ms\t  8123 bytes/ms",
    ].join("\n");

    assert.deepEqual(parseTimedFileRows(output), [
      {
        file: "examples\\AMDGPU\\ops.mlir",
        parseMs: 5.99,
        speedBytesMs: 9363,
      },
      {
        file: "examples\\Affine\\ops.mlir",
        parseMs: 14.5,
        speedBytesMs: 8123,
      },
    ]);
  });
});

describe("AST manifest helpers", () => {
  test("structuralSexp strips positions and normalizes CRLF", () => {
    const raw = "(toplevel [0, 0] - [2, 0]\r\n  rhs: (operation [0, 0] - [0, 5]))\r\n";

    assert.equal(structuralSexp(raw), "(toplevel\n  rhs: (operation))");
  });

  test("assertManifestSchema rejects an incompatible manifest schema", () => {
    assert.doesNotThrow(() =>
      assertManifestSchema({ schemaVersion: SCHEMA_VERSION }),
    );
    assert.throws(
      () => assertManifestSchema({ schemaVersion: SCHEMA_VERSION + 1 }),
      /incompatible with this tool/,
    );
  });

  test("splitTreesByFile aligns each tree to its file and flags errors", () => {
    const stdout = [
      "(toplevel [0, 0] - [1, 0]",
      "  (a [0, 0] - [0, 1]))",
      "(toplevel [0, 0] - [1, 0]",
      "  (ERROR [0, 0] - [0, 1]))",
    ].join("\n");

    const result = splitTreesByFile(stdout, ["x.mlir", "y.mlir"]);

    assert.equal(result.length, 2);
    assert.equal(result[0].file, "x.mlir");
    assert.equal(result[0].hasError, false);
    assert.equal(result[1].hasError, true);
  });

  test("splitTreesByFile throws when tree count does not match file count", () => {
    const stdout = "(toplevel [0, 0] - [1, 0])";

    assert.throws(
      () => splitTreesByFile(stdout, ["x.mlir", "y.mlir"]),
      /Expected 2 parse trees but found 1/,
    );
  });

  test("diffManifests reports added, missing, source, AST, and parse-error changes", () => {
    const expected = {
      files: [
        {
          file: "examples/ok.mlir",
          sourceSha256: "src-a",
          astSha256: "ast-a",
          hasError: false,
        },
        {
          file: "examples/missing.mlir",
          sourceSha256: "src-missing",
          astSha256: "ast-missing",
          hasError: false,
        },
        {
          file: "examples/error-status.mlir",
          sourceSha256: "src-status",
          astSha256: "ast-status",
          hasError: true,
        },
      ],
    };
    const actual = {
      files: [
        {
          file: "examples/ok.mlir",
          sourceSha256: "src-b",
          astSha256: "ast-b",
          hasError: true,
        },
        {
          file: "examples/added.mlir",
          sourceSha256: "src-added",
          astSha256: "ast-added",
          hasError: false,
        },
        {
          file: "examples/error-status.mlir",
          sourceSha256: "src-status",
          astSha256: "ast-status",
          hasError: false,
        },
      ],
    };

    assert.deepEqual(diffManifests(expected, actual), [
      { type: "MISSING_FILE", file: "examples/missing.mlir" },
      { type: "ADDED_FILE", file: "examples/added.mlir" },
      { type: "PARSE_ERROR_STATUS_CHANGED", file: "examples/error-status.mlir" },
      { type: "NEW_PARSE_ERROR", file: "examples/ok.mlir" },
      { type: "SOURCE_CHANGED", file: "examples/ok.mlir" },
      { type: "AST_CHANGED", file: "examples/ok.mlir" },
    ]);
  });
});
