import { spawn } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TREE_SITTER =
  process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter";
const CORPUS_DIR = "test/corpus";

function splitTests(text) {
  return text.split(/(?=^={8,}\r?\n)/m);
}

function getTestMeta(chunk) {
  const lines = chunk.split(/\r?\n/);
  const name = lines[1]?.trim() ?? "";
  let isCst = false;
  for (let i = 2; i < lines.length; i++) {
    if (/^={8,}$/.test(lines[i])) break;
    if (lines[i].trim() === ":cst") {
      isCst = true;
      break;
    }
  }
  const sepIndex = lines.findIndex((line) => /^-{8,}$/.test(line));
  const expected =
    sepIndex >= 0 ? lines.slice(sepIndex + 1).join("\n").trim() : "";
  return { name, isCst, expected };
}

function listCorpusFiles() {
  return readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => join(CORPUS_DIR, f));
}

function parseUpdatedNames(output) {
  const updated = new Set();
  const match = output.match(
    /^\d+ updates?:\s*\r?\n([\s\S]*?)(?:\r?\nsyntax highlighting:|\r?\nTotal parses:|$)/m,
  );
  if (!match) return updated;
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s+\d+\.\s+(.+?)\s*$/);
    if (item) updated.add(item[1]);
  }
  return updated;
}

function runTreeSitter(args) {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(TREE_SITTER, args, {
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });
    const forward = (stream, dest) => {
      stream.on("data", (chunk) => {
        output += chunk.toString();
        dest.write(chunk);
      });
    };
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

// Work around tree-sitter CLI 0.27.x `test --update` rewriting untouched files
// (adding stray EOF blank lines) and wiping untouched `:cst` expectations in
// files that have other updated tests.
const savedFiles = new Map();
const savedCst = new Map();
for (const file of listCorpusFiles()) {
  const content = readFileSync(file, "utf8");
  savedFiles.set(file, content);
  for (const chunk of splitTests(content)) {
    const { name, isCst } = getTestMeta(chunk);
    if (isCst && name) {
      savedCst.set(`${file}\0${name}`, chunk);
    }
  }
}

const extraArgs = process.argv.slice(2);
const { code, output } = await runTreeSitter(["test", "--update", ...extraArgs]);
const updatedNames = parseUpdatedNames(output);

const wipedUpdatedCst = [];
let restoredCount = 0;

for (const file of listCorpusFiles()) {
  const current = readFileSync(file, "utf8");
  const original = savedFiles.get(file);
  const chunks = splitTests(current);
  const hasAnyUpdatedTest = chunks.some(({ length }, idx) => {
    void length;
    const { name } = getTestMeta(chunks[idx]);
    return name && updatedNames.has(name);
  });

  if (!hasAnyUpdatedTest) {
    if (original !== undefined && current !== original) {
      writeFileSync(file, original, "utf8");
    }
    continue;
  }

  let changed = false;
  const nextChunks = chunks.map((chunk) => {
    const { name, isCst, expected } = getTestMeta(chunk);
    if (!isCst || !name) return chunk;
    const saved = savedCst.get(`${file}\0${name}`);
    if (!saved) return chunk;

    if (!updatedNames.has(name)) {
      if (chunk !== saved) {
        restoredCount++;
        changed = true;
        return saved;
      }
      return chunk;
    }

    if (expected.length === 0) {
      wipedUpdatedCst.push(`${file}: ${name}`);
      changed = true;
      return saved;
    }
    return chunk;
  });

  const normalized = nextChunks.join("").replace(/\n+$/, "\n");
  if (changed || normalized !== current) {
    writeFileSync(file, normalized, "utf8");
  }
}

if (restoredCount > 0) {
  console.error(
    `[update-tests] Preserved ${restoredCount} untouched :cst test expectation(s).`,
  );
}

if (wipedUpdatedCst.length > 0) {
  console.error(
    "[update-tests] Error: tree-sitter --update wiped changed :cst test(s); restored snapshots:",
  );
  for (const item of wipedUpdatedCst) {
    console.error(`  - ${item}`);
  }
  console.error(
    'Update these :cst tests individually with: npm run update-tests -- -i "<test name>"',
  );
  process.exit(1);
}

process.exit(code);
