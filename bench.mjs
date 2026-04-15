'use strict';

import * as cp from "node:child_process";
import * as process from "node:process";
import * as path from "node:path";
import * as fs from "node:fs";

const MIN_PCT = 100;

let mlir_testdir = path.join(process.cwd(), "examples");

let dialects = fs.readdirSync(mlir_testdir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

function bench_dialect(dialect) {
  let testdir = path.join(mlir_testdir, dialect);
  let testfiles = Array.from(fs.globSync(`${testdir}/*.mlir`));
  if (testfiles.length === 0) return;
  let child = cp.spawn("npx", ["tree-sitter", "parse", "-q", "--stat", ...testfiles],
    { cwd: process.cwd() });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data) => output += data);
  child.on("close", () => {
    let match = output.match(/success percentage: (\d+\.\d+)%/i);
    let pass_pct = parseFloat(match[1]);
    if (pass_pct < MIN_PCT) {
      console.log("%s, %f%% passed; minimum required is %d%%", dialect, pass_pct, MIN_PCT);
      process.exit(1);
    }
    console.log("%s, %f%% passed", dialect, pass_pct);
  });
  child.on("error", (err) => console.log(err));
}

for (const dialect of dialects) {
  bench_dialect(dialect);
}
