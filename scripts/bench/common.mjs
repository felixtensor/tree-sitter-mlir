// Shared primitives for the dev gate/diagnostic scripts.

import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

// Minimum file size (bytes) for size-filtered baseline/slow passes; shared so the
// <1KB cutoff stays identical across baseline.mjs and slow.mjs.
export const DEFAULT_MIN_FILE_SIZE = 1024;

export function resolveTreeSitterExecutable(root = process.cwd()) {
  const executable =
    process.platform === "win32" ? "tree-sitter.exe" : "tree-sitter";
  return path.join(root, "node_modules", "tree-sitter-cli", executable);
}

export function readTreeSitterCliVersion(root = process.cwd()) {
  const packageJson = JSON.parse(
    fs.readFileSync(
      path.join(root, "node_modules", "tree-sitter-cli", "package.json"),
      "utf8",
    ),
  );
  return packageJson.version;
}

export function median(values) {
  if (values.length === 0) {
    throw new Error("Cannot compute median of an empty list");
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function collectMlirFiles(root, { minSizeBytes = 0 } = {}) {
  const files = [];

  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".mlir")) {
        if (minSizeBytes > 0 && fs.statSync(fullPath).size < minSizeBytes) {
          continue;
        }
        files.push(fullPath);
      }
    }
  }

  visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

export function spawnTreeSitter(args, { cwd = process.cwd() } = {}) {
  const executable = resolveTreeSitterExecutable(cwd);

  return new Promise((resolve, reject) => {
    const child = cp.spawn(executable, args, {
      cwd,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

// tree-sitter's --paths takes a file of newline-separated paths, avoiding the Windows
// command-line length limit when the whole suite is passed at once.
export async function withPathsFile(files, callback) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tree-sitter-mlir-"));
  const pathsFile = path.join(tmpDir, "paths.txt");

  try {
    fs.writeFileSync(pathsFile, `${files.join("\n")}\n`);
    return await callback(pathsFile);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function parseStatSummary(output) {
  const match = output.match(
    /Total parses:\s*(\d+);\s*successful parses:\s*(\d+);\s*failed parses:\s*(\d+);\s*success percentage:\s*(\d+(?:\.\d+)?)%;\s*average speed:\s*(\d+(?:\.\d+)?)\s*bytes\/ms/i,
  );

  if (!match) {
    throw new Error("Unable to parse tree-sitter --stat output");
  }

  return {
    totalParses: Number.parseInt(match[1], 10),
    successfulParses: Number.parseInt(match[2], 10),
    failedParses: Number.parseInt(match[3], 10),
    successPercentage: Number.parseFloat(match[4]),
    averageSpeedBytesMs: Number.parseFloat(match[5]),
  };
}

export async function runStat(files, args = []) {
  if (files.length === 0) {
    throw new Error("No .mlir files matched the benchmark input");
  }

  return await withPathsFile(files, async (pathsFile) => {
    const result = await spawnTreeSitter([
      "parse",
      "-q",
      "--stat",
      "--paths",
      pathsFile,
      ...args,
    ]);
    const summary = parseStatSummary(`${result.stdout}\n${result.stderr}`);
    return { ...result, summary };
  });
}

export function parsePositiveInteger(name, value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} requires a positive integer`);
  }
  return parsed;
}

export function parseNonNegativeInteger(name, value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} requires a non-negative integer`);
  }
  return parsed;
}

export function isMainModule(scriptUrl) {
  if (!process.argv[1]) {
    return false;
  }

  return scriptUrl === pathToFileURL(path.resolve(process.argv[1])).href;
}
