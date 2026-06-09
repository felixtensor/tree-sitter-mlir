// Unified CLI facade for the 1.6 dev gates.

import process from "node:process";

import {
  DEFAULT_MIN_FILE_SIZE,
  isMainModule,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseStatSummary,
} from "./common.mjs";
import {
  DEFAULT_BASELINE_PATH,
  DEFAULT_BASELINE_RUNS,
  DEFAULT_WARMUP_RUNS,
  platformKey,
  runBaseline,
  upsertPlatformBaseline,
} from "./baseline.mjs";
import { runCorrectnessGate } from "./parse-gate.mjs";
import {
  DEFAULT_SLOW_COUNT,
  main as runSlowMain,
  parseArgs as parseSlowArgs,
} from "./slow.mjs";
import {
  main as runSnapshotMain,
  parseArgs as parseSnapshotArgs,
} from "./snapshot.mjs";

function setMode(options, mode, arg) {
  if (options.mode !== "correctness" && options.mode !== mode) {
    throw new Error(
      `Conflicting bench modes: cannot combine ${arg} with --${options.mode}`,
    );
  }
  options.mode = mode;
}

function parseArgs(argv) {
  const options = {
    mode: "correctness",
    runs: DEFAULT_BASELINE_RUNS,
    warmupRuns: DEFAULT_WARMUP_RUNS,
    minSizeBytes: DEFAULT_MIN_FILE_SIZE,
    baselinePath: DEFAULT_BASELINE_PATH,
    delegateArgs: [],
    slowCount: DEFAULT_SLOW_COUNT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--baseline") {
      setMode(options, "baseline", arg);
    } else if (arg === "--slow") {
      setMode(options, "slow", arg);
      options.delegateArgs = argv.slice(i + 1);
      const slowOptions = parseSlowArgs(options.delegateArgs);
      options.slowCount = slowOptions.count;
      options.runs = slowOptions.runs;
      options.minSizeBytes = slowOptions.minSizeBytes;
      options.outputPath = slowOptions.outputPath;
      return options;
    } else if (arg === "--snapshot" || arg === "--verify") {
      const mode = arg.slice(2);
      setMode(options, mode, arg);
      options.delegateArgs = argv.slice(i);
      const snapshotOptions = parseSnapshotArgs(options.delegateArgs);
      options.manifestPath = snapshotOptions.manifestPath;
      options.exampleRoot = snapshotOptions.exampleRoot;
      return options;
    } else if (arg === "--runs") {
      options.runs = parsePositiveInteger(arg, argv[++i]);
    } else if (arg === "--warmup") {
      options.warmupRuns = parseNonNegativeInteger(arg, argv[++i]);
    } else if (arg === "--min-size") {
      options.minSizeBytes = parseNonNegativeInteger(arg, argv[++i]);
    } else if (arg === "--output") {
      options.baselinePath = argv[++i];
      if (!options.baselinePath) {
        throw new Error("--output requires a path");
      }
    } else if (arg === "--help" || arg === "-h") {
      setMode(options, "help", arg);
    } else {
      throw new Error(`Unknown bench option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node bench.mjs [mode] [options]

Modes:
  default         Per-dialect correctness gate, requiring 100% parse success.
  --baseline      Record this platform's median whole-suite average speed into
                  bench/baseline.json under platforms["<platform>-<arch>"];
                  entries for other platforms are preserved.
  --slow [N]      Print the N slowest examples/ files by bytes/ms; default ${DEFAULT_SLOW_COUNT}.
  --snapshot      Freeze source + structural AST hashes into bench/ast-manifest.json.
  --verify        Verify current source + AST hashes against bench/ast-manifest.json.

Options:
  --runs N        Runs to median for the baseline speed; default ${DEFAULT_BASELINE_RUNS}.
  --warmup N      Unrecorded baseline warmup runs; default ${DEFAULT_WARMUP_RUNS}.
  --min-size N    Minimum file size in bytes for the baseline; default ${DEFAULT_MIN_FILE_SIZE}.
  --output PATH   Baseline output path; default ${DEFAULT_BASELINE_PATH}.

Mode-specific options after --slow are passed to scripts/bench/slow.mjs;
options after --snapshot/--verify are passed to scripts/bench/snapshot.mjs.
`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.mode === "help") {
    printHelp();
  } else if (options.mode === "baseline") {
    await runBaseline(options);
  } else if (options.mode === "slow") {
    await runSlowMain(options.delegateArgs);
  } else if (options.mode === "snapshot" || options.mode === "verify") {
    await runSnapshotMain(options.delegateArgs);
  } else {
    await runCorrectnessGate();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export {
  main,
  parseArgs,
  parseStatSummary,
  platformKey,
  upsertPlatformBaseline,
};
