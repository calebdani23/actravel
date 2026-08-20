import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mod = await import('../scripts/captured-type-tsc.mjs');

test('exports and fixed identities are closed', () => {
  assert.equal(mod.EXPECTED_SNAPSHOT_PATH, 'tmp/audit-evidence/baseline-reconcile-remote-types.ts');
  assert.match(mod.EXPECTED_SNAPSHOT_SHA256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(mod).sort(), ['CANONICAL_DB_TYPES_PATH', 'EXPECTED_SNAPSHOT_PATH', 'EXPECTED_SNAPSHOT_SHA256', 'GENERATED_ROUTE_PATHS', 'createCompilerSeams', 'createGitProvider', 'renderBlockedError', 'renderResult', 'runCapturedTypeTsc'].sort());
});

test('renderer preserves exact key order and compact JSON', () => {
  const value = mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT' });
  assert.deepEqual(Object.keys(value), ['schema', 'snapshot', 'sourcePreimage', 'baselineDiagnostics', 'candidateDiagnostics', 'blocker', 'status']);
  assert.deepEqual(Object.keys(value.snapshot), ['path', 'expectedSha256', 'observedSha256', 'bytes']);
  assert.deepEqual(Object.keys(value.sourcePreimage), ['head', 'manifestSha256', 'fileCount', 'tsconfigSha256', 'typescriptVersion', 'compilerApiSha256']);
  assert.equal(JSON.stringify(value).includes('\n'), false);
  assert.throws(() => mod.renderResult({ status: 'COMPATIBLE' }), /status/);
  assert.throws(() => mod.renderResult({ blocker: 'NOPE' }), /blocker/);
  assert.throws(() => mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', blocker: 'GIT_BOUNDARY' }), /blocker/);
});

test('blocked result maps the requested cause', () => {
  const result = mod.renderBlockedError('GENERATED_REQUEST');
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.blocker, 'GENERATED_REQUEST');
  assert.deepEqual(Object.keys(result), ['schema', 'snapshot', 'sourcePreimage', 'baselineDiagnostics', 'candidateDiagnostics', 'blocker', 'status']);
  for (const blocker of ['SNAPSHOT_IDENTITY', 'GIT_BOUNDARY', 'CONFIG_ROOT', 'GENERATED_REQUEST', 'BASELINE_DIAGNOSTIC', 'CANDIDATE_DIAGNOSTIC', 'PREIMAGE_CHANGED', 'COMPILER_FAILURE']) assert.equal(mod.renderBlockedError(blocker).blocker, blocker);
});

test('host-compatible enumeration filters TypeScript paths in JavaScript', async () => {
  const calls = [];
  const executor = async (argv, options) => { calls.push({ argv, options }); const stdout = argv[0] === 'ls-tree' ? Buffer.from('100644 blob 0123456789012345678901234567890123456789\tREADME.md\0' + '100644 blob abcdefabcdefabcdefabcdefabcdefabcdefabcd\tfoo.ts\0') : Buffer.alloc(0); return { stdout, stderr: '', status: 0 }; };
  const provider = mod.createGitProvider({ repoRoot: process.cwd(), executor });
  for (const operation of ['head', 'manifest', 'diff', 'untracked']) { try { await provider[operation](); } catch {} }
  try { await provider.blobs([]); } catch {}
  assert.deepEqual(calls.map((x) => x.argv), [
    ['rev-parse', '--verify', 'HEAD^{commit}'],
    ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
    ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', 'HEAD'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
    ['cat-file', '--batch'],
  ]);
  assert.ok(calls.every((x) => x.options.cwd === process.cwd() && x.options.shell === false));
  assert.deepEqual(Object.keys(calls[0].options.env).sort(), ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_EXTERNAL_DIFF', 'GIT_OPTIONAL_LOCKS', 'GIT_PAGER', 'LC_ALL', 'PATH'].sort());
});

test('compiler seams virtualize only the two route declarations', () => {
  const seams = mod.createCompilerSeams({ repoRoot: '/repo', baseline: 'base', candidate: 'candidate', readFile: () => { throw new Error('disk'); } });
  for (const route of mod.GENERATED_ROUTE_PATHS) assert.equal(seams.readFile(route), '');
  assert.equal(seams.readFile('lib/supabase/database.types.ts', 'baseline'), 'base');
  assert.throws(() => seams.readFile('.next/types/other.d.ts'), /GENERATED_REQUEST/);
});

test('no-argument CLI contract is represented by the fixed snapshot', () => assert.equal(mod.EXPECTED_SNAPSHOT_PATH.split('/').length, 3));

test('unsafe diff paths and nonzero diff status fail closed', async () => {
  const snapshot = await readFile(mod.EXPECTED_SNAPSHOT_PATH);
  const base = { head: async () => 'b'.repeat(40), manifest: async () => Buffer.alloc(0), diff: async () => Buffer.from('../escape.ts\0'), untracked: async () => Buffer.alloc(0), blobs: async () => Buffer.alloc(0) };
  const fsReadFile = async (p) => p.endsWith(mod.EXPECTED_SNAPSHOT_PATH) ? snapshot : Buffer.from('{}');
  assert.equal((await mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider: base, fsReadFile })).blocker, 'GIT_BOUNDARY');
  const nonzero = mod.createGitProvider({ repoRoot: process.cwd(), executor: async (argv) => ({ stdout: '', stderr: '', status: argv[0] === 'diff' ? 1 : 0 }) });
  await assert.rejects(nonzero.diff(), /GIT_BOUNDARY/);
});

test('missing tracked worktree bytes map to PREIMAGE_CHANGED', async () => {
  const snapshot = await readFile(mod.EXPECTED_SNAPSHOT_PATH), oid = 'a'.repeat(40);
  const provider = { head: async () => oid, manifest: async () => Buffer.from(`100644 blob ${oid}\tmissing.ts\0`), diff: async () => Buffer.alloc(0), untracked: async () => Buffer.alloc(0), blobs: async () => Buffer.from(`${oid} blob 0\n\n`) };
  const fsReadFile = async (p) => p.endsWith(mod.EXPECTED_SNAPSHOT_PATH) ? snapshot : Buffer.from('{}');
  assert.equal((await mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider, fsReadFile })).blocker, 'PREIMAGE_CHANGED');
});

test('renderer rejects malformed nested values and preserves blocker coherence', () => {
  assert.throws(() => mod.renderResult({ status: 'BLOCKED', blocker: null }), /status/);
  assert.throws(() => mod.renderResult({ status: 'BLOCKED', blocker: 'GIT_BOUNDARY', snapshot: {} }), /result/);
  assert.throws(() => mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', baselineDiagnostics: [{ code: -1, path: null, line: null, character: null, messageHash: '0'.repeat(64) }] }), /diagnostics/);
  assert.throws(() => mod.renderResult({ status: 'BLOCKED', blocker: 'GIT_BOUNDARY', bytes: -1 }), /snapshot/);
});

test('provider rejects every nonzero status, unsafe OID, count, and exact command drift', async () => {
  const calls = [];
  const p = mod.createGitProvider({ repoRoot: process.cwd(), executor: async (argv, options) => { calls.push({ argv, options }); return { stdout: Buffer.alloc(0), status: 0 }; } });
  await p.head(); await p.manifest(); await p.diff(); await p.untracked(); await p.blobs([]);
  assert.deepEqual(calls.map((x) => x.argv), [['rev-parse', '--verify', 'HEAD^{commit}'], ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'], ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', 'HEAD'], ['ls-files', '--others', '--exclude-standard', '-z'], ['cat-file', '--batch']]);
  assert.throws(() => p.blobs(['x'.repeat(39)]), /GIT_BOUNDARY/);
  const bad = mod.createGitProvider({ repoRoot: process.cwd(), executor: async () => ({ stdout: '', status: 1 }) });
  await assert.rejects(bad.head(), /GIT_BOUNDARY/);
  assert.ok(calls.every((x) => x.options.shell === false && x.options.cwd === process.cwd() && x.options.maxBuffer === 80 * 1024 * 1024));
});

test('route virtualization is exact and never delegates route reads', () => {
  let reads = 0;
  const seams = mod.createCompilerSeams({ repoRoot: '/repo', baseline: 'b', candidate: 'c', readFile: () => { reads += 1; return 'disk'; } });
  for (const route of mod.GENERATED_ROUTE_PATHS) { assert.equal(seams.readFile(route), ''); assert.equal(seams.fileExists(route), true); }
  assert.equal(reads, 0);
  assert.throws(() => seams.readFile('.next/types/generated.d.ts'), /GENERATED_REQUEST/);
  assert.equal(seams.readFile('lib/supabase/database.types.ts', 'baseline'), 'b');
  assert.equal(seams.readFile('lib/supabase/database.types.ts', 'candidate'), 'c');
});

test('malformed manifest, cat-file header, length, and trailing bytes fail closed', async () => {
  const snapshot = await readFile(mod.EXPECTED_SNAPSHOT_PATH);
  const run = async (manifest, blob) => mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider: { head: async () => 'a'.repeat(40), manifest: async () => Buffer.from(manifest), diff: async () => Buffer.alloc(0), untracked: async () => Buffer.alloc(0), blobs: async () => Buffer.from(blob) }, fsReadFile: async (p) => p.endsWith(mod.EXPECTED_SNAPSHOT_PATH) ? snapshot : Buffer.from('{}') });
  assert.equal((await run('../x.ts\0', '')).blocker, 'GIT_BOUNDARY');
  const oid = 'a'.repeat(40), m = `100644 blob ${oid}\tx.ts\0`;
  assert.equal((await run(m, `bad blob 0\n\n`)).blocker, 'GIT_BOUNDARY');
  assert.equal((await run(m, `${oid} blob 999999999999999999999\n`)).blocker, 'GIT_BOUNDARY');
  assert.equal((await run(m, `${oid} blob 0\n\nextra`)).blocker, 'GIT_BOUNDARY');
});

test('preimage checkpoint repeats identity before diagnostic and final semantic returns', async () => {
  const snapshot = await readFile(mod.EXPECTED_SNAPSHOT_PATH), counts = { head: 0, manifest: 0, diff: 0, untracked: 0, blobs: 0 };
  const provider = { head: async () => { counts.head += 1; return 'a'.repeat(40); }, manifest: async () => { counts.manifest += 1; return Buffer.alloc(0); }, diff: async () => { counts.diff += 1; return Buffer.alloc(0); }, untracked: async () => { counts.untracked += 1; return Buffer.alloc(0); }, blobs: async () => { counts.blobs += 1; return Buffer.alloc(0); } };
  const fsReadFile = async (p) => p.endsWith(mod.EXPECTED_SNAPSHOT_PATH) ? snapshot : p.endsWith('tsconfig.json') ? Buffer.from('{}') : Buffer.from('');
  const result = await mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider, fsReadFile });
  assert.equal(result.blocker, 'CONFIG_ROOT');
  assert.ok(counts.head >= 2 && counts.manifest >= 2 && counts.diff >= 2 && counts.blobs >= 2);
});

test('fixed CLI contract has no argument mode and closed statuses', () => {
  assert.equal(mod.EXPECTED_SNAPSHOT_PATH, 'tmp/audit-evidence/baseline-reconcile-remote-types.ts');
  assert.equal(mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT' }).blocker, null);
  assert.equal(mod.renderBlockedError('COMPILER_FAILURE').status, 'BLOCKED');
});

test('diagnostic arrays are dense, exact, ordered, and copied', () => {
  const diagnostic = { code: 2345, path: 'src/a.ts', line: 2, character: 3, messageHash: 'a'.repeat(64) };
  const result = mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', baselineDiagnostics: [diagnostic] });
  assert.deepEqual(Object.keys(result.baselineDiagnostics[0]), ['code', 'path', 'line', 'character', 'messageHash']);
  assert.notEqual(result.baselineDiagnostics[0], diagnostic);
  assert.throws(() => mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', baselineDiagnostics: Object.assign([], { 1: diagnostic, length: 2 }) }), /diagnostics/);
  assert.throws(() => mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', baselineDiagnostics: [{ path: 'src/a.ts', code: 2345, line: 2, character: 3, messageHash: 'a'.repeat(64) }] }), /diagnostics/);
  assert.throws(() => mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', baselineDiagnostics: [{ ...diagnostic, extra: true }] }), /diagnostics/);
  assert.throws(() => mod.renderResult({ status: 'TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT', baselineDiagnostics: [null] }), /diagnostics/);
});

test('ls-tree ignores unrelated non-blobs but blocks selected TS non-blobs', async () => {
  const snapshot = await readFile(mod.EXPECTED_SNAPSHOT_PATH), oid = 'b'.repeat(40);
  const run = (manifest) => mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider: { head: async () => 'a'.repeat(40), manifest: async () => Buffer.from(manifest), diff: async () => Buffer.alloc(0), untracked: async () => Buffer.alloc(0), blobs: async () => Buffer.from(`${oid} blob 1\nx\n`) }, fsReadFile: async (p) => p.endsWith(mod.EXPECTED_SNAPSHOT_PATH) ? snapshot : p.endsWith('foo.ts') ? Buffer.from('x') : Buffer.from('{}') });
  assert.equal((await run(`120000 commit ${'c'.repeat(40)}\tREADME.md\0${'100644 blob ' + oid}\tfoo.ts\0`)).blocker, 'CONFIG_ROOT');
  assert.equal((await run(`120000 commit ${'c'.repeat(40)}\tfoo.ts\0`)).blocker, 'GIT_BOUNDARY');
});

test('compiler exceptions and semantic returns receive a complete postimage', async () => {
  const snapshot = await readFile(mod.EXPECTED_SNAPSHOT_PATH), counts = { head: 0, manifest: 0, diff: 0, untracked: 0, blobs: 0 };
  const provider = { head: async () => { counts.head++; return counts.head === 1 ? 'a'.repeat(40) : 'b'.repeat(40); }, manifest: async () => { counts.manifest++; return Buffer.alloc(0); }, diff: async () => { counts.diff++; return Buffer.alloc(0); }, untracked: async () => { counts.untracked++; return Buffer.alloc(0); }, blobs: async () => { counts.blobs++; return Buffer.alloc(0); } };
  const fsReadFile = async (p) => p.endsWith(mod.EXPECTED_SNAPSHOT_PATH) ? snapshot : (() => { throw new Error('compiler'); })();
  const result = await mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider, fsReadFile });
  assert.equal(result.blocker, 'PREIMAGE_CHANGED');
  assert.deepEqual(counts, { head: 2, manifest: 2, diff: 2, untracked: 2, blobs: 2 });
});

test('compatible postimage drift returns a fresh blocked result', async () => {
  const base = mod.createGitProvider({ repoRoot: process.cwd() }); let heads = 0;
  const result = await mod.runCapturedTypeTsc({ repoRoot: process.cwd(), provider: { ...base, head: async () => { const value = await base.head(); return ++heads === 1 ? value : 'c'.repeat(40); } } });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.blocker, 'PREIMAGE_CHANGED');
  assert.deepEqual(Object.keys(result), ['schema', 'snapshot', 'sourcePreimage', 'baselineDiagnostics', 'candidateDiagnostics', 'blocker', 'status']);
  assert.match(result.sourcePreimage.head, /^[a-f0-9]{40}$/);
  assert.equal(result.snapshot.observedSha256, mod.EXPECTED_SNAPSHOT_SHA256);
});

test('source has explicit no-emit and no-write runtime boundaries', async () => {
  const source = await readFile(new URL('../scripts/captured-type-tsc.mjs', import.meta.url), 'utf8');
  assert.match(source, /noEmit:\s*true/);
  assert.doesNotMatch(source, /writeFile|mkdir|rm\(/);
  assert.match(source, /finalizeWithPostimage/);
});
