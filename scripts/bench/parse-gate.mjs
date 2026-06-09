// Default examples parse gate: every dialect directory must parse at 100%.

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

import { collectMlirFiles, runStat } from "./common.mjs";

export const MIN_PCT = 100;

function dialectDirectories(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function runCorrectnessGate({
  exampleRoot = path.join(process.cwd(), "examples"),
} = {}) {
  for (const dialect of dialectDirectories(exampleRoot)) {
    const testFiles = collectMlirFiles(path.join(exampleRoot, dialect));
    if (testFiles.length === 0) {
      continue;
    }

    const { code, summary } = await runStat(testFiles);
    if (code !== 0 || summary.successPercentage < MIN_PCT) {
      console.log(
        "%s, %f%% passed; minimum required is %d%%",
        dialect,
        summary.successPercentage,
        MIN_PCT,
      );
      process.exitCode = 1;
      return;
    }

    console.log("%s, %f%% passed", dialect, summary.successPercentage);
  }
}
