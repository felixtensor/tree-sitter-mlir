import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);

const DIALECTS = [
  { name: 'builtin', docUrl: 'https://mlir.llvm.org/docs/Dialects/Builtin/' },
  { name: 'func', docUrl: 'https://mlir.llvm.org/docs/Dialects/Func/' },
  { name: 'cf', docUrl: 'https://mlir.llvm.org/docs/Dialects/ControlFlowDialect/' },
  { name: 'affine', docUrl: 'https://mlir.llvm.org/docs/Dialects/Affine/' },
  { name: 'arith', docUrl: 'https://mlir.llvm.org/docs/Dialects/ArithOps/' },
  { name: 'bufferization', docUrl: 'https://mlir.llvm.org/docs/Dialects/BufferizationOps/' },
  { name: 'linalg', docUrl: 'https://mlir.llvm.org/docs/Dialects/Linalg/' },
  { name: 'llvm', docUrl: 'https://mlir.llvm.org/docs/Dialects/LLVM/' },
  { name: 'math', docUrl: 'https://mlir.llvm.org/docs/Dialects/MathOps/' },
  { name: 'memref', docUrl: 'https://mlir.llvm.org/docs/Dialects/MemRef/' },
  { name: 'scf', docUrl: 'https://mlir.llvm.org/docs/Dialects/SCFDialect/' },
  { name: 'tensor', docUrl: 'https://mlir.llvm.org/docs/Dialects/TensorOps/' },
  { name: 'vector', docUrl: 'https://mlir.llvm.org/docs/Dialects/Vector/' }
];

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function extractOpsFromOperationsSection(html, dialectName) {
  const m = html.match(/<h2[^>]*\bid\s*=\s*["']?operations["']?[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  if (!m) return [];
  const section = m[1];
  const ops = [];
  for (const mm of section.matchAll(/<code>([a-z]+\.[A-Za-z0-9_.]+)<\/code>/g)) {
    const full = mm[1];
    if (full.startsWith(`${dialectName}.`)) ops.push(full);
  }
  return uniqueSorted(ops);
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return await res.text();
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

async function extractOpsFromDialectJs(dialectName) {
  const filePath = path.join(projectRoot, 'dialect', `${dialectName}.js`);
  const text = await fs.readFile(filePath, 'utf8');
  const ops = [];
  for (const m of text.matchAll(/'([a-z]+)\.([A-Za-z0-9_\\.]+)'/g)) {
    const full = `${m[1]}.${m[2]}`;
    if (full.startsWith(`${dialectName}.`)) ops.push(full);
  }
  return uniqueSorted(ops);
}

async function extractOpsFromHighlights(dialectName) {
  const filePath = path.join(projectRoot, 'queries', 'highlights.scm');
  const text = await fs.readFile(filePath, 'utf8');
  const ops = [];
  for (const m of text.matchAll(/"([a-z]+)\.([A-Za-z0-9_\\.]+)"/g)) {
    const full = `${m[1]}.${m[2]}`;
    if (full.startsWith(`${dialectName}.`)) ops.push(full);
  }
  return uniqueSorted(ops);
}

function diffSets(a, b) {
  const setB = new Set(b);
  const setA = new Set(a);
  return {
    onlyA: a.filter(x => !setB.has(x)),
    onlyB: b.filter(x => !setA.has(x))
  };
}

function formatList(values, max = 50) {
  if (values.length === 0) return '(none)';
  const shown = values.slice(0, max);
  const tail = values.length > max ? ` ... (+${values.length - max})` : '';
  return shown.join(', ') + tail;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyDialect = args.find(a => a.startsWith('--dialect='))?.split('=')[1];
  const dialects = onlyDialect ? DIALECTS.filter(d => d.name === onlyDialect) : DIALECTS;
  if (dialects.length === 0) {
    throw new Error(`Unknown dialect in --dialect=. Supported: ${DIALECTS.map(d => d.name).join(', ')}`);
  }

  let hasDiff = false;

  for (const d of dialects) {
    const [dialectOps, highlightOps, html] = await Promise.all([
      extractOpsFromDialectJs(d.name),
      extractOpsFromHighlights(d.name),
      fetchText(d.docUrl)
    ]);

    const docOps = extractOpsFromOperationsSection(html, d.name);

    const dialectVsDoc = diffSets(dialectOps, docOps);
    const highlightVsDoc = diffSets(highlightOps, docOps);

    const dialectMissing = dialectVsDoc.onlyB;
    const dialectExtra = dialectVsDoc.onlyA;
    const highlightMissing = highlightVsDoc.onlyB;
    const highlightExtra = highlightVsDoc.onlyA;

    if (dialectMissing.length || dialectExtra.length || highlightMissing.length || highlightExtra.length) {
      hasDiff = true;
    }

    process.stdout.write(`\n[${d.name}]\n`);
    process.stdout.write(`doc ops: ${docOps.length}, dialect/*.js ops: ${dialectOps.length}, highlights ops: ${highlightOps.length}\n`);
    process.stdout.write(`missing in dialect/*.js: ${dialectMissing.length} -> ${formatList(dialectMissing)}\n`);
    process.stdout.write(`extra in dialect/*.js:   ${dialectExtra.length} -> ${formatList(dialectExtra)}\n`);
    process.stdout.write(`missing in highlights:   ${highlightMissing.length} -> ${formatList(highlightMissing)}\n`);
    process.stdout.write(`extra in highlights:     ${highlightExtra.length} -> ${formatList(highlightExtra)}\n`);
  }

  if (hasDiff) process.exitCode = 1;
}

main().catch(err => {
  console.error(err?.stack ?? String(err));
  process.exit(2);
});
