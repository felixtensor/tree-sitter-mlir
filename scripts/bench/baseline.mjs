// Platform-keyed performance baseline for the examples/ corpus.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import process from "node:process";

import {
  DEFAULT_MIN_FILE_SIZE,
  collectMlirFiles,
  median,
  readTreeSitterCliVersion,
  runStat,
} from "./common.mjs";
import { DEFAULT_SLOW_COUNT, collectSlowestFiles } from "./slow.mjs";

export const DEFAULT_BASELINE_RUNS = 3;
export const DEFAULT_WARMUP_RUNS = 1;
export const DEFAULT_BASELINE_PATH = path.join("bench", "baseline.json");
export const BASELINE_SCHEMA_VERSION = 2;

// How tree-sitter `parse --stat` computes "average speed", verified empirically: it is
// bytes-weighted aggregate throughput -- floor(total_bytes * 1000 / total_parse_us), an
// integer bytes/ms. Because it weights by bytes it is dominated by the largest files and
// barely moves with the <1KB filter, so a regression isolated to small files will NOT show
// here -- run `node bench.mjs --slow` for that. Speeds are only comparable within the same platform,
// hence the platform-keyed `platforms` map (see platformKey).
export const SPEED_METRIC =
  "tree-sitter `parse --stat` aggregate throughput: floor(total_bytes * 1000 / total_parse_us) in bytes/ms; bytes-weighted, dominated by large files and ~insensitive to the <1KB filter. Compare only within the same platforms[] entry; pair with `node bench.mjs --slow` to catch small-file regressions the aggregate hides.";

export function describeEnvironment() {
  const [cpu] = os.cpus();
  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpu: cpu ? cpu.model.trim() : "unknown",
    cpuCount: os.cpus().length,
    node: process.version,
    treeSitterCli: readTreeSitterCliVersion(),
  };
}

export function platformKey(environment) {
  return `${environment.platform}-${environment.arch}`;
}

export function loadExistingBaseline(baselinePath) {
  let raw;
  try {
    raw = fs.readFileSync(baselinePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Existing baseline at ${baselinePath} is not valid JSON; refusing to overwrite it. Fix or delete the file, then re-run. (${error.message})`,
    );
  }
}

export function upsertPlatformBaseline(existing, key, entry) {
  const base =
    existing &&
    existing.schemaVersion === BASELINE_SCHEMA_VERSION &&
    existing.platforms
      ? existing
      : {
          schemaVersion: BASELINE_SCHEMA_VERSION,
          speedMetric: SPEED_METRIC,
          platforms: {},
        };

  return {
    ...base,
    schemaVersion: BASELINE_SCHEMA_VERSION,
    speedMetric: SPEED_METRIC,
    platforms: {
      ...base.platforms,
      [key]: entry,
    },
  };
}

export async function runBaseline({
  runs = DEFAULT_BASELINE_RUNS,
  warmupRuns = DEFAULT_WARMUP_RUNS,
  minSizeBytes = DEFAULT_MIN_FILE_SIZE,
  baselinePath = DEFAULT_BASELINE_PATH,
} = {}) {
  const exampleRoot = path.join(process.cwd(), "examples");
  const allFiles = collectMlirFiles(exampleRoot);
  const files = collectMlirFiles(exampleRoot, { minSizeBytes });

  for (let i = 0; i < warmupRuns; i += 1) {
    await runStat(files);
  }

  const summaries = [];
  for (let i = 0; i < runs; i += 1) {
    const { code, summary } = await runStat(files);
    if (code !== 0 || summary.successPercentage < 100) {
      throw new Error(
        `Baseline parse success was ${summary.successPercentage}%; expected 100%`,
      );
    }
    summaries.push(summary);
  }

  const speeds = summaries.map((summary) => summary.averageSpeedBytesMs);
  const environment = describeEnvironment();
  const key = platformKey(environment);
  const entry = {
    createdAt: new Date().toISOString(),
    exampleRoot: path.relative(process.cwd(), exampleRoot),
    totalExampleFiles: allFiles.length,
    measuredFiles: files.length,
    excludedSmallFiles: allFiles.length - files.length,
    minFileSizeBytes: minSizeBytes,
    runs,
    warmupRuns,
    averageSpeedBytesMs: median(speeds),
    runAverageSpeedsBytesMs: speeds,
    successPercentage: median(
      summaries.map((summary) => summary.successPercentage),
    ),
    environment,
  };

  const existing = loadExistingBaseline(baselinePath);
  const previous = existing?.platforms?.[key];
  entry.slowestFiles = await collectSlowestFiles({
    count: DEFAULT_SLOW_COUNT,
    runs,
    minSizeBytes,
  });
  const baseline = upsertPlatformBaseline(existing, key, entry);

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);

  if (previous) {
    console.log(
      "updated %s baseline: %d -> %d bytes/ms (node %s->%s, tree-sitter-cli %s->%s)",
      key,
      previous.averageSpeedBytesMs,
      entry.averageSpeedBytesMs,
      previous.environment?.node ?? "?",
      environment.node,
      previous.environment?.treeSitterCli ?? "?",
      environment.treeSitterCli,
    );
  } else {
    console.log(
      "recorded new %s baseline: %d bytes/ms",
      key,
      entry.averageSpeedBytesMs,
    );
  }
  console.log(
    "  median of %d runs over %d measured files (%d total, %d excluded under %d bytes)",
    runs,
    files.length,
    allFiles.length,
    entry.excludedSmallFiles,
    minSizeBytes,
  );
  console.log(
    "  platforms on file: %s; wrote %s",
    Object.keys(baseline.platforms).join(", "),
    baselinePath,
  );
}
