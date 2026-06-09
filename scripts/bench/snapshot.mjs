// AST surface snapshot gate for the examples/ corpus.
// `--snapshot` freezes source + structural AST hashes; `--verify` compares current output.

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

import {
  collectMlirFiles,
  isMainModule,
  readTreeSitterCliVersion,
  spawnTreeSitter,
  withPathsFile,
} from "./common.mjs";

const DEFAULT_MANIFEST_PATH = path.join("bench", "ast-manifest.json");
const DEFAULT_EXAMPLE_ROOT = "examples";
const SCHEMA_VERSION = 1;
const MANIFEST_NOTE =
  "Frozen parse manifest + AST surface hashes. astSha256 = sha256 of the position-stripped, newline-normalized parse tree (node types + fields), platform-independent and changing only when the tree shape/fields change. sourceSha256 separates an edited example from a grammar reshape. Verify with `node bench.mjs --verify`.";

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function manifestPath(file) {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}

function structuralSexp(raw) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\[\d+,\s*\d+\][ \t]*-[ \t]*\[\d+,\s*\d+\]/g, "")
    .replace(/[ \t]+\)/g, ")")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function splitTreesByFile(stdout, files) {
  const trees = [];
  let start = -1;
  let depth = 0;

  for (let i = 0; i < stdout.length; i += 1) {
    const char = stdout[i];
    if (char === "(") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        throw new Error("Unbalanced parse tree output");
      }
      if (depth === 0 && start !== -1) {
        trees.push(stdout.slice(start, i + 1).trim());
        start = -1;
      }
    }
  }

  if (depth !== 0) {
    throw new Error("Unbalanced parse tree output");
  }

  if (trees.length !== files.length) {
    throw new Error(
      `Expected ${files.length} parse trees but found ${trees.length}`,
    );
  }

  return trees.map((tree, index) => ({
    file: files[index],
    tree,
    hasError: /\b(?:ERROR|MISSING)\b/.test(tree),
  }));
}

async function parseTrees(files) {
  return await withPathsFile(files, async (pathsFile) => {
    const result = await spawnTreeSitter(["parse", "--paths", pathsFile]);
    const rows = splitTreesByFile(result.stdout, files);
    return { code: result.code, rows, stderr: result.stderr };
  });
}

async function buildManifest({
  exampleRoot = DEFAULT_EXAMPLE_ROOT,
  files = null,
} = {}) {
  const root = path.resolve(process.cwd(), exampleRoot);
  const mlirFiles = files ?? collectMlirFiles(root);
  const { rows } = await parseTrees(mlirFiles);
  const entries = rows.map((row) => {
    const source = fs.readFileSync(row.file);
    return {
      file: manifestPath(row.file),
      sourceSha256: sha256(source),
      astSha256: sha256(structuralSexp(row.tree)),
      hasError: row.hasError,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    exampleRoot: manifestPath(root),
    fileCount: entries.length,
    erroredFileCount: entries.filter((entry) => entry.hasError).length,
    treeSitterCli: readTreeSitterCliVersion(),
    note: MANIFEST_NOTE,
    files: entries,
  };
}

function diffManifests(expected, actual) {
  const diffs = [];
  const expectedByFile = new Map(
    expected.files.map((entry) => [entry.file, entry]),
  );
  const actualByFile = new Map(
    actual.files.map((entry) => [entry.file, entry]),
  );

  for (const file of [...expectedByFile.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    if (!actualByFile.has(file)) {
      diffs.push({ type: "MISSING_FILE", file });
    }
  }

  for (const file of [...actualByFile.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    const expectedEntry = expectedByFile.get(file);
    const actualEntry = actualByFile.get(file);
    if (!expectedEntry) {
      diffs.push({ type: "ADDED_FILE", file });
      continue;
    }

    if (actualEntry.hasError && !expectedEntry.hasError) {
      diffs.push({ type: "NEW_PARSE_ERROR", file });
    } else if (actualEntry.hasError !== expectedEntry.hasError) {
      diffs.push({ type: "PARSE_ERROR_STATUS_CHANGED", file });
    }

    if (actualEntry.sourceSha256 !== expectedEntry.sourceSha256) {
      diffs.push({ type: "SOURCE_CHANGED", file });
    }

    if (actualEntry.astSha256 !== expectedEntry.astSha256) {
      diffs.push({ type: "AST_CHANGED", file });
    }
  }

  return diffs;
}

function loadManifest(manifestFile) {
  return JSON.parse(fs.readFileSync(manifestFile, "utf8"));
}

function assertManifestSchema(manifest) {
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `AST manifest schema ${manifest.schemaVersion} is incompatible with this tool (expects ${SCHEMA_VERSION}); re-run \`node bench.mjs --snapshot\` to regenerate.`,
    );
  }
}

async function writeSnapshot(options) {
  const manifest = await buildManifest({ exampleRoot: options.exampleRoot });
  fs.mkdirSync(path.dirname(options.manifestPath), { recursive: true });
  fs.writeFileSync(
    options.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    "wrote AST manifest: %s (%d files, %d with parse errors)",
    options.manifestPath,
    manifest.fileCount,
    manifest.erroredFileCount,
  );
}

async function verifySnapshot(options) {
  const expected = loadManifest(options.manifestPath);
  assertManifestSchema(expected);
  const actual = await buildManifest({
    exampleRoot: expected.exampleRoot ?? options.exampleRoot,
  });
  const diffs = diffManifests(expected, actual);

  if (diffs.length === 0) {
    console.log(
      "verified AST manifest: %s (%d files)",
      options.manifestPath,
      actual.fileCount,
    );
    return;
  }

  console.error(
    "AST manifest verification failed: %d differences",
    diffs.length,
  );
  for (const diff of diffs.slice(0, 50)) {
    console.error("%s\t%s", diff.type, diff.file);
  }
  if (diffs.length > 50) {
    console.error("... %d more differences", diffs.length - 50);
  }
  process.exitCode = 1;
}

function setMode(options, mode, arg) {
  if (options.mode && options.mode !== mode) {
    throw new Error(
      `Conflicting snapshot modes: cannot combine ${arg} with --${options.mode}`,
    );
  }
  options.mode = mode;
}

function parseArgs(argv) {
  const options = {
    mode: null,
    manifestPath: DEFAULT_MANIFEST_PATH,
    exampleRoot: DEFAULT_EXAMPLE_ROOT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--snapshot") {
      setMode(options, "snapshot", arg);
    } else if (arg === "--verify") {
      setMode(options, "verify", arg);
    } else if (arg === "--output" || arg === "--manifest") {
      options.manifestPath = argv[++i];
      if (!options.manifestPath) {
        throw new Error(`${arg} requires a path`);
      }
    } else if (arg === "--examples") {
      options.exampleRoot = argv[++i];
      if (!options.exampleRoot) {
        throw new Error("--examples requires a path");
      }
    } else if (arg === "--help" || arg === "-h") {
      setMode(options, "help", arg);
    } else {
      throw new Error(`Unknown snapshot option: ${arg}`);
    }
  }

  if (!options.mode) {
    throw new Error("snapshot.mjs requires --snapshot or --verify");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/bench/snapshot.mjs (--snapshot | --verify) [options]

Modes:
  --snapshot       Freeze current examples/ source + structural AST hashes.
  --verify         Compare current examples/ output against the frozen manifest.

Options:
  --output PATH    Snapshot output path; default ${DEFAULT_MANIFEST_PATH}.
  --manifest PATH  Manifest path for snapshot or verify; default ${DEFAULT_MANIFEST_PATH}.
  --examples PATH  Example root; default ${DEFAULT_EXAMPLE_ROOT}.
`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.mode === "help") {
    printHelp();
  } else if (options.mode === "snapshot") {
    await writeSnapshot(options);
  } else {
    await verifySnapshot(options);
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export {
  SCHEMA_VERSION,
  assertManifestSchema,
  buildManifest,
  diffManifests,
  main,
  parseArgs,
  splitTreesByFile,
  structuralSexp,
  verifySnapshot,
  writeSnapshot,
};
