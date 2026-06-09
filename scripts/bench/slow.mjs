// Slow-file perf diagnostic: the N slowest examples by bytes/ms (input to 1.6.1 hotspot
// audit). Not a gate -- it only reports. Optionally writes the report as JSON via --output.

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

import {
  DEFAULT_MIN_FILE_SIZE,
  collectMlirFiles,
  isMainModule,
  median,
  parseNonNegativeInteger,
  parsePositiveInteger,
  spawnTreeSitter,
  withPathsFile,
} from "./common.mjs";

export const DEFAULT_SLOW_COUNT = 15;
export const DEFAULT_RUNS = 3;

function parseTimedFileRows(output) {
  const rows = [];
  const pattern = /^(.+?)\tParse:\s*([0-9.]+)\s*ms\s+([0-9.]+)\s*bytes\/ms/gm;

  for (const match of output.matchAll(pattern)) {
    rows.push({
      file: match[1].trimEnd(),
      parseMs: Number.parseFloat(match[2]),
      speedBytesMs: Number.parseFloat(match[3]),
    });
  }

  if (rows.length === 0) {
    throw new Error("Unable to parse tree-sitter --time output");
  }

  return rows;
}

async function runTimedFiles(files) {
  return await withPathsFile(files, async (pathsFile) => {
    const result = await spawnTreeSitter([
      "parse",
      "-t",
      "-q",
      "--paths",
      pathsFile,
    ]);
    const rows = parseTimedFileRows(`${result.stdout}\n${result.stderr}`);
    const sizeByFile = new Map(
      files.map((file) => [path.resolve(file), fs.statSync(file).size]),
    );

    return rows.map((row) => {
      const file = path.resolve(row.file);
      return {
        ...row,
        file,
        sizeBytes: sizeByFile.get(file) ?? fs.statSync(file).size,
      };
    });
  });
}

// Aggregates per-file timing across several `-t` passes, by median. A single pass swings ~2x
// run-to-run on the sub-millisecond small files; median (not mean) because parse-timing noise
// is one-sided -- interference only makes a parse slower, so a mean is dragged down by outliers
// the median ignores. Median also commutes with speed = bytes/time, so median-speed equals
// bytes/median-time, keeping the reported number unambiguous.
async function runTimedFilesRepeated(files, runs) {
  const byFile = new Map();

  for (let i = 0; i < runs; i += 1) {
    for (const row of await runTimedFiles(files)) {
      let acc = byFile.get(row.file);
      if (!acc) {
        acc = {
          file: row.file,
          sizeBytes: row.sizeBytes,
          speeds: [],
          parseMsValues: [],
        };
        byFile.set(row.file, acc);
      }
      acc.speeds.push(row.speedBytesMs);
      acc.parseMsValues.push(row.parseMs);
    }
  }

  return [...byFile.values()].map((acc) => ({
    file: acc.file,
    sizeBytes: acc.sizeBytes,
    speedBytesMs: Math.round(median(acc.speeds)),
    parseMs: median(acc.parseMsValues),
  }));
}

function summarizeSlowest(rows, count) {
  return [...rows]
    .sort((a, b) => a.speedBytesMs - b.speedBytesMs)
    .slice(0, count)
    .map((row) => ({
      file: path.relative(process.cwd(), row.file),
      speedBytesMs: row.speedBytesMs,
      parseMs: Number(row.parseMs.toFixed(2)),
      sizeBytes: row.sizeBytes,
    }));
}

function parseArgs(argv) {
  const options = {
    help: false,
    count: DEFAULT_SLOW_COUNT,
    runs: DEFAULT_RUNS,
    minSizeBytes: DEFAULT_MIN_FILE_SIZE,
    outputPath: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--runs") {
      options.runs = parsePositiveInteger(arg, argv[++i]);
    } else if (arg === "--min-size") {
      options.minSizeBytes = parseNonNegativeInteger(arg, argv[++i]);
    } else if (arg === "--output") {
      options.outputPath = argv[++i];
      if (!options.outputPath) {
        throw new Error("--output requires a path");
      }
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (!arg.startsWith("-")) {
      options.count = parsePositiveInteger("count", arg);
    } else {
      throw new Error(`Unknown slow option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/bench/slow.mjs [N] [options]

Prints the N slowest examples/ files by bytes/ms (median over runs); default ${DEFAULT_SLOW_COUNT}.

Options:
  --runs N        Runs to median per-file timing over; default ${DEFAULT_RUNS}.
  --min-size N    Minimum file size in bytes; default ${DEFAULT_MIN_FILE_SIZE}.
  --output PATH   Also write the report as JSON to PATH.
`);
}

async function runSlowReport(options) {
  const slowest = await collectSlowestFiles(options);

  console.log(
    "slowest %d files (min size %d bytes, median of %d runs):",
    slowest.length,
    options.minSizeBytes,
    options.runs,
  );
  for (const row of slowest) {
    console.log(
      "%d bytes/ms\t%s ms\t%d bytes\t%s",
      row.speedBytesMs,
      row.parseMs.toFixed(2),
      row.sizeBytes,
      row.file,
    );
  }

  if (options.outputPath) {
    const report = {
      generatedAt: new Date().toISOString(),
      platform: `${process.platform}-${process.arch}`,
      minFileSizeBytes: options.minSizeBytes,
      runs: options.runs,
      slowest,
    };
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(
      options.outputPath,
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.log("wrote %s", options.outputPath);
  }
}

async function collectSlowestFiles({
  count = DEFAULT_SLOW_COUNT,
  runs = DEFAULT_RUNS,
  minSizeBytes = DEFAULT_MIN_FILE_SIZE,
} = {}) {
  const exampleRoot = path.join(process.cwd(), "examples");
  const files = collectMlirFiles(exampleRoot, { minSizeBytes });
  const rows = await runTimedFilesRepeated(files, runs);
  return summarizeSlowest(rows, count);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
  } else {
    await runSlowReport(options);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { collectSlowestFiles, main, parseArgs, parseTimedFileRows };
