import { spawn } from "node:child_process";

const TREE_SITTER =
  process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter";
// tree-sitter v0.26.11 can report these failures while still exiting zero.
const FAILURE_PATTERN =
  /corpus tests? failed fuzzing|Incorrect (?:initial )?parse|Unexpected scope change/i;
const KNOWN_REGRESSION_SEED = "18110457282759957479";

function runFuzz(args, { env = {} } = {}) {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(TREE_SITTER, ["fuzz", ...args], {
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });

    const forward = (stream, destination) => {
      stream.on("data", (chunk) => {
        output += chunk.toString();
        destination.write(chunk);
      });
    };

    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code !== 0) {
        reject(
          new Error(
            signal
              ? `tree-sitter fuzz terminated by ${signal}`
              : `tree-sitter fuzz exited with code ${code}`,
          ),
        );
      } else if (FAILURE_PATTERN.test(output)) {
        reject(
          new Error("tree-sitter fuzz reported an incremental parse failure"),
        );
      } else {
        resolve();
      }
    });
  });
}

try {
  // Rebuild once, then replay the observed incremental regression seed against
  // every corpus test without coupling the runner to a particular test name.
  await runFuzz(["--rebuild", "--iterations", "1"], {
    env: { TREE_SITTER_SEED: KNOWN_REGRESSION_SEED },
  });

  // Exercise the complete corpus with a fresh seed by default. Inheriting an
  // explicitly set TREE_SITTER_SEED also lets local callers replay a seed range.
  await runFuzz(["--iterations", "300"]);
} catch (error) {
  console.error(`Fuzz failed: ${error.message}`);
  process.exitCode = 1;
}
