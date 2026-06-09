// Compatibility shim for the bench/dev-gate CLI.

import process from "node:process";

import { isMainModule } from "./scripts/bench/common.mjs";
import { main } from "./scripts/bench/cli.mjs";

export {
  main,
  parseArgs,
  parseStatSummary,
  platformKey,
  upsertPlatformBaseline,
} from "./scripts/bench/cli.mjs";

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
