'use strict';

import * as cp from "node:child_process";
import * as process from "node:process";
import * as path from "node:path";
import { glob } from "glob";

const dialects = {
  "Affine": 100,
  "Arith": 100,
  "Builtin": 100,
  "ControlFlow": 100,
  "Func": 100,
  "IR": 80,
  "Linalg": 100,
  "MemRef": 100,
  "SCF": 100,
  "Tensor": 100,
  "Vector": 100,
};

let mlir_testdir = path.join(process.cwd(), "examples");

function bench_dialect(dialect, min_pct) {
  let testdir = path.join(mlir_testdir, dialect);
  let testfiles = glob.sync(`${testdir}/*.mlir`, { ignore: [`${testdir}/invalid.mlir`] });
  let child = cp.spawn("npx", ["tree-sitter", "parse", "-q", "-s", ...testfiles],
    { cwd: process.cwd() });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data) => output += data);
  child.on("close", () => {
    let match = output.match(/success percentage: (\d+\.\d+)%/i);
    let pass_pct = parseFloat(match[1]);
    if (pass_pct < min_pct) {
      console.log("%s, %f%% passed; minimum required is %d%%", dialect, pass_pct, min_pct);
      process.exit(1);
    }
    console.log("%s, %f%% passed", dialect, pass_pct);
  });
  child.on("error", (err) => console.log(err));
}

for (const [k, v] of Object.entries(dialects)) {
  bench_dialect(k, v);
}
