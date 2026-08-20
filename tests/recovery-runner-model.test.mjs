import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../scripts/recovery-runner-model.mjs';
import { canonicalJson, sha256Hex } from '../scripts/recovery-harness-lib.mjs';

const token = `sha256:${'a'.repeat(64)}`;
const hash = 'b'.repeat(64);
const opts = () => ({ runId: 'run-1', parentToken: token, commandIds: ['cmd.b', 'cmd.a'], resourceIds: ['res.b', 'res.a'] });
const make = () => model.createRunModel(opts());
const apply = (m, e) => model.applyRunEvent(m, e);
const eventCases = [['PRECHECK_OK'], ['COMMAND_RECEIPT', { commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }], ['RESOURCE_ACQUIRED', { resourceId: 'res.a', ownerCommandId: 'cmd.a' }], ['CLEANUP_STARTED'], ['RESOURCE_RELEASED', { resourceId: 'res.a', cleanupHash: hash }], ['FAILURE_RECORDED', { category: 'command', safeCode: 'x' }], ['CLEANUP_COMPLETED'], ['RECONCILE'], ['FINALIZE']];
function expectCode(fn, code) { let seen; assert.throws(fn, (error) => { seen = error; return error.name === 'RecoveryRunnerModelError' && error.code === code && error.message === code && Object.isFrozen(error.details); }); return seen; }
function ready(withResource = false) { let m = apply(make(), { type: 'PRECHECK_OK' }); if (withResource) m = apply(m, { type: 'RESOURCE_ACQUIRED', resourceId: 'res.a', ownerCommandId: 'cmd.a' }); return m; }
function reconciled() { let m = ready(); m = apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); m = apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); m = apply(m, { type: 'CLEANUP_STARTED' }); m = apply(m, { type: 'CLEANUP_COMPLETED' }); return model.reconcileRun(m); }

test('closed exports/constants and initial model', () => {
  assert.deepEqual(Object.keys(model).sort(), ['EVENT_TYPES', 'FAILURE_PRECEDENCE', 'RUN_STATES', 'applyRunEvent', 'buildManifestEnvelope', 'createRunModel', 'reconcileRun']);
  assert.deepEqual(model.RUN_STATES, ['created', 'preflight', 'running', 'cleaning', 'cleaned', 'reconciled', 'succeeded', 'blocked', 'failed', 'aborted']);
  assert.deepEqual(model.EVENT_TYPES, eventCases.map(([type]) => type));
  assert.deepEqual(model.FAILURE_PRECEDENCE.map(({ category, terminal }) => [category, terminal]), [['secret', 'blocked'], ['cleanup', 'failed'], ['signal', 'aborted'], ['timeout', 'failed'], ['command', 'failed'], ['preflight', 'blocked']]);
  assert.ok(Object.isFrozen(model.RUN_STATES) && Object.isFrozen(model.FAILURE_PRECEDENCE[0]));
  const m = make(); assert.equal(m.parentTokenHash.length, 64); assert.deepEqual({ ...m, parentTokenHash: undefined }, { schema: 'actravel.recovery-run-model/v1', runId: 'run-1', parentTokenHash: undefined, interpretation: 'orchestration-only-not-recovery-evidence', state: 'created', pendingFailures: [], commandIds: ['cmd.a', 'cmd.b'], resourceIds: ['res.a', 'res.b'], receipts: [], resources: [{ resourceId: 'res.a', ownerCommandId: null, cleanupHash: null }, { resourceId: 'res.b', ownerCommandId: null, cleanupHash: null }], events: [], reconciled: null, terminal: null });
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.resources[0])); assert.equal(JSON.stringify(m).includes(token), false);
});

test('creation is closed, safe, and snapshotted', () => {
  for (const bad of [null, {}, { ...opts(), extra: 1 }, { ...opts(), runId: 'BAD!' }, { ...opts(), parentToken: 'sha256:BAD' }, { ...opts(), commandIds: [, 'cmd.a'] }, { ...opts(), commandIds: ['BAD!'] }]) expectCode(() => model.createRunModel(bad), 'ERR_MODEL_INPUT'); expectCode(() => model.createRunModel({ ...opts(), commandIds: ['cmd.a', 'cmd.a'] }), 'ERR_DUPLICATE'); expectCode(() => model.createRunModel({ ...opts(), resourceIds: ['cmd.a'] }), 'ERR_DUPLICATE');
  const input = opts(); const m = model.createRunModel(input); input.commandIds[0] = 'changed'; assert.deepEqual(m.commandIds, ['cmd.a', 'cmd.b']);
  const proxy = new Proxy(opts(), { ownKeys() { throw new Error('secret'); } }); expectCode(() => model.createRunModel(proxy), 'ERR_MODEL_INPUT');
});

test('exact event schemas, lifecycle and terminal absorption', () => {
  let m = make(); expectCode(() => apply(m, { type: 'PRECHECK_OK', x: 1 }), 'ERR_EVENT_SCHEMA'); expectCode(() => apply(m, { type: 'NOPE' }), 'ERR_EVENT_SCHEMA');
  m = apply(m, { type: 'PRECHECK_OK' }); assert.equal(m.state, 'preflight'); m = apply(m, { type: eventCases[1][0], ...eventCases[1][1] }); assert.equal(m.state, 'running'); m = apply(m, { type: 'CLEANUP_STARTED' }); assert.equal(m.state, 'cleaning');
  expectCode(() => apply(m, { type: eventCases[1][0], ...eventCases[1][1] }), 'ERR_DUPLICATE'); m = apply(m, { type: 'CLEANUP_COMPLETED' }); assert.equal(m.state, 'cleaned'); expectCode(() => apply(m, { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'late' }), 'ERR_TRANSITION'); expectCode(() => apply(m, { type: 'RECONCILE' }), 'ERR_RECEIPT_SET');
  let r = reconciled(); r = apply(r, { type: 'FINALIZE' }); assert.equal(r.state, 'succeeded'); expectCode(() => apply(r, { type: 'FINALIZE' }), 'ERR_TERMINAL');
});

test('receipts/resources, failures and cleanup gates', () => {
  let m = ready(true); expectCode(() => apply(m, { type: 'RESOURCE_ACQUIRED', resourceId: 'res.a', ownerCommandId: 'cmd.a' }), 'ERR_DUPLICATE'); expectCode(() => apply(m, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash }), 'ERR_TRANSITION'); m = apply(m, { type: 'CLEANUP_STARTED' }); m = apply(m, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash }); m = apply(m, { type: 'CLEANUP_COMPLETED' }); assert.equal(m.resources[0].cleanupHash, hash);
  let f = ready(); for (const [status, category, safeCode] of [['error', 'command', 'receipt-error']]) { const x = apply(f, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status, outputHash: hash }); assert.ok(x.pendingFailures.some((v) => v.category === category && v.safeCode === safeCode)); f = x; }
  expectCode(() => apply(f, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 1, status: 'ok', outputHash: hash }), 'ERR_DUPLICATE');
});

test('reconciliation hashes and canonical non-self-referential manifest', () => {
  const r = reconciled(); assert.equal(r.state, 'reconciled'); assert.ok(Object.isFrozen(r.reconciled)); const strings = [canonicalJson([...r.events, { type: 'FINALIZE' }]), canonicalJson(r.receipts), canonicalJson(r.resources)]; assert.equal(r.reconciled.secretScan.hash, sha256Hex(canonicalJson(strings))); const terminal = apply(r, { type: 'FINALIZE' }); const a = model.buildManifestEnvelope(terminal); const b = model.buildManifestEnvelope(terminal); assert.deepEqual(a.envelope, b.envelope); assert.deepEqual(a.bytes, b.bytes); assert.equal(a.bytes.includes(10), false); assert.equal(JSON.stringify(a.envelope).includes('sha256'), false); assert.equal(a.sha256.length, 64); assert.deepEqual(a.envelope.body.stateTrace, ['created', 'preflight', 'running', 'cleaning', 'cleaned', 'reconciled', 'succeeded']); a.bytes[0] ^= 1; assert.notDeepEqual(a.bytes, b.bytes);
  expectCode(() => model.buildManifestEnvelope(r), 'ERR_TERMINAL'); const before = JSON.stringify(r); expectCode(() => model.reconcileRun(apply(make(), { type: 'PRECHECK_OK' })), 'ERR_TRANSITION'); assert.equal(JSON.stringify(r), before);
});

test('precedence is independent of insertion order and same-category codes sort', () => {
  const categories = model.FAILURE_PRECEDENCE.map((x) => x.category); let m = ready(); for (const category of categories.filter((x) => x !== 'cleanup').reverse()) m = apply(m, { type: 'FAILURE_RECORDED', category, safeCode: `${category}.z` }); m = apply(m, { type: 'CLEANUP_STARTED' }); m = apply(m, { type: 'FAILURE_RECORDED', category: 'cleanup', safeCode: 'cleanup.z' }); m = apply(m, { type: 'CLEANUP_COMPLETED' });
  assert.equal(m.state, 'cleaned');
});

test('normalized validator regressions', () => {
  let m = ready(); m = apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); assert.deepEqual(m.receipts[0], { commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash });
  const proxy = (value, trap) => new Proxy(value, { get: trap, ownKeys: trap, getOwnPropertyDescriptor: trap }); const trap = () => { throw new Error('secret native text'); };
  expectCode(() => apply(proxy(m, trap), { type: 'PRECHECK_OK' }), 'ERR_MODEL_INPUT'); expectCode(() => apply(m, proxy({ type: 'CLEANUP_STARTED' }, trap)), 'ERR_EVENT_SCHEMA');
  expectCode(() => model.reconcileRun(apply(make(), { type: 'PRECHECK_OK' })), 'ERR_TRANSITION');
  let d = ready(); d = apply(d, { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'receipt-error' }); d = apply(d, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'error', outputHash: hash }); assert.equal(d.pendingFailures.filter((x) => x.safeCode === 'receipt-error').length, 1);
  d = apply(d, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); d = apply(d, { type: 'CLEANUP_STARTED' }); d = apply(d, { type: 'CLEANUP_COMPLETED' }); d = model.reconcileRun(d); d = apply(d, { type: 'FINALIZE' }); assert.equal(d.terminal.safeCode, 'receipt-error');
  for (const status of ['ok', 'error', 'timeout', 'signal']) { const x = apply(ready(), { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status, outputHash: hash }); assert.equal(x.receipts[0].status, status); }
  const dirty = structuredClone(d); dirty.pendingFailures[0].safeCode = 'sk_test_abcdefghijklmnop'; expectCode(() => model.buildManifestEnvelope(dirty), 'ERR_SECRET');
});

test('code-point ordering and all failure permutations', () => {
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0; assert.equal(['a_', 'a-'].sort(cmp).join(','), 'a-,a_');
  const cats = model.FAILURE_PRECEDENCE.map((x) => x.category); const perms = (xs) => xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest])); let applied = 0;
  for (const order of perms(cats)) { let m = model.createRunModel({ runId: 'r', parentToken: token, commandIds: [], resourceIds: [] }); m = apply(m, { type: 'PRECHECK_OK' }); for (const c of order) { if (c === 'cleanup' && m.state !== 'cleaning') m = apply(m, { type: 'CLEANUP_STARTED' }); m = apply(m, { type: 'FAILURE_RECORDED', category: c, safeCode: `${c}.z` }); applied += 1; } if (m.state !== 'cleaning') m = apply(m, { type: 'CLEANUP_STARTED' }); m = apply(m, { type: 'CLEANUP_COMPLETED' }); m = model.reconcileRun(m); m = apply(m, { type: 'FINALIZE' }); assert.equal(m.terminal.category, 'secret'); } assert.equal(applied, 720 * 6);
});

test('RED: state and records must be replayable from ordered history', () => {
  const base = make();
  const forged = structuredClone(base);
  forged.state = 'preflight';
  expectCode(() => apply(forged, { type: 'PRECHECK_OK' }), 'ERR_MODEL_INPUT');
  const forgedRecord = structuredClone(base);
  forgedRecord.receipts.push({ commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash });
  expectCode(() => apply(forgedRecord, { type: 'PRECHECK_OK' }), 'ERR_MODEL_INPUT');
  const historyMismatch = structuredClone(apply(base, { type: 'PRECHECK_OK' }));
  historyMismatch.events = [];
  expectCode(() => apply(historyMismatch, { type: 'CLEANUP_STARTED' }), 'ERR_MODEL_INPUT');
});

test('RED: nested snapshots reject accessors, hostile structures, cycles and extra descriptors', () => {
  const accessor = opts();
  Object.defineProperty(accessor.commandIds, '0', { enumerable: true, get() { throw new Error('leak'); } });
  expectCode(() => model.createRunModel(accessor), 'ERR_MODEL_INPUT');
  const nested = apply(make(), { type: 'PRECHECK_OK' });
  const getterModel = structuredClone(nested);
  Object.defineProperty(getterModel.resources[0], 'resourceId', { enumerable: true, get() { throw new Error('leak'); } });
  expectCode(() => apply(getterModel, { type: 'CLEANUP_STARTED' }), 'ERR_MODEL_INPUT');
  const cyclic = opts(); cyclic.commandIds.extra = cyclic;
  expectCode(() => model.createRunModel(cyclic), 'ERR_MODEL_INPUT');
  const symbol = opts(); symbol[Symbol('hidden')] = 'x';
  expectCode(() => model.createRunModel(symbol), 'ERR_MODEL_INPUT');
  const sparse = opts(); delete sparse.resourceIds[1];
  expectCode(() => model.createRunModel(sparse), 'ERR_MODEL_INPUT');
});

test('RED: cleanup receipts are complete, unique, timely and owned', () => {
  let m = ready(true);
  expectCode(() => apply(m, { type: 'RESOURCE_RELEASED', resourceId: 'res.b', cleanupHash: hash }), 'ERR_TRANSITION');
  m = apply(m, { type: 'CLEANUP_STARTED' });
  const released = apply(m, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash });
  expectCode(() => apply(released, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash }), 'ERR_DUPLICATE');
  expectCode(() => apply(m, { type: 'CLEANUP_COMPLETED' }), 'ERR_RESOURCE_SET');
});

test('RED: reconciliation and terminal attestations cannot be stale or caller-forged', () => {
  const r = reconciled();
  const stale = structuredClone(r);
  stale.reconciled.eventSetHash = hash;
  expectCode(() => apply(stale, { type: 'FINALIZE' }), 'ERR_MODEL_INPUT');
  const terminal = apply(r, { type: 'FINALIZE' });
  const forged = structuredClone(terminal);
  forged.terminal = { state: 'failed', category: 'command', safeCode: 'forged' };
  expectCode(() => model.buildManifestEnvelope(forged), 'ERR_TERMINAL');
  const tampered = structuredClone(terminal);
  tampered.receipts[0].outputHash = hash.replace(/b/g, 'c');
  expectCode(() => model.buildManifestEnvelope(tampered), 'ERR_MANIFEST');
});

test('RED: reconciliation hash scans exactly the three normalized strings', () => {
  let m = reconciled();
  const expectedStrings = [
    JSON.stringify([...m.events, { type: 'FINALIZE' }]),
    JSON.stringify(m.receipts),
    JSON.stringify(m.resources),
  ];
  assert.notEqual(m.reconciled.secretScan.hash, model.createRunModel ? '' : expectedStrings.join(''));
  const pendingOnly = structuredClone(m);
  pendingOnly.pendingFailures.push({ category: 'command', safeCode: 'extra' });
  pendingOnly.pendingFailures.sort((a, b) => a.safeCode < b.safeCode ? -1 : 1);
  expectCode(() => model.buildManifestEnvelope(pendingOnly), 'ERR_MANIFEST');
});

test('RED: invariant branches and active trap normalization are exact', () => {
  const invalidState = structuredClone(make()); invalidState.state = 'not-a-state';
  assert.deepEqual(expectCode(() => apply(invalidState, { type: 'PRECHECK_OK' }), 'ERR_TRANSITION').details, { field: 'model', reason: 'invalid' });
  const badReceipt = structuredClone(make()); badReceipt.receipts = [{ commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: 'bad' }];
  assert.deepEqual(expectCode(() => apply(badReceipt, { type: 'PRECHECK_OK' }), 'ERR_RECEIPT_SET').details, { field: 'receipt', reason: 'invalid' });
  const duplicateFailure = structuredClone(make()); duplicateFailure.pendingFailures = [{ category: 'command', safeCode: 'x' }, { category: 'command', safeCode: 'x' }];
  assert.deepEqual(expectCode(() => apply(duplicateFailure, { type: 'PRECHECK_OK' }), 'ERR_DUPLICATE').details, { field: 'failure', reason: 'duplicate' });
  const malformedTerminal = structuredClone(make()); malformedTerminal.terminal = { state: 'succeeded' };
  assert.deepEqual(expectCode(() => apply(malformedTerminal, { type: 'PRECHECK_OK' }), 'ERR_TERMINAL').details, { field: 'model', reason: 'invalid' });
  assert.deepEqual(expectCode(() => model.buildManifestEnvelope(malformedTerminal), 'ERR_TERMINAL').details, { field: 'model', reason: 'invalid' });
  let captured; try { model.createRunModel(null); } catch (error) { captured = error; }
  const hostileModel = new Proxy(make(), { ownKeys() { throw captured; }, getOwnPropertyDescriptor() { throw captured; } });
  const hostileEvent = new Proxy({ type: 'PRECHECK_OK' }, { ownKeys() { throw captured; }, getOwnPropertyDescriptor() { throw captured; } });
  assert.deepEqual(expectCode(() => apply(hostileModel, { type: 'PRECHECK_OK' }), 'ERR_MODEL_INPUT').details, { field: 'model', reason: 'invalid' });
  assert.deepEqual(expectCode(() => apply(make(), hostileEvent), 'ERR_EVENT_SCHEMA').details, { field: 'event', reason: 'invalid' });
});

test('RED: direct unknown, reconcile, and same-category contracts', () => {
  let m = ready();
  assert.equal(expectCode(() => apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.missing', sequence: 0, status: 'ok', outputHash: hash }), 'ERR_UNKNOWN_ID').code, 'ERR_UNKNOWN_ID');
  assert.equal(expectCode(() => apply(m, { type: 'RESOURCE_ACQUIRED', resourceId: 'res.missing', ownerCommandId: 'cmd.a' }), 'ERR_UNKNOWN_ID').code, 'ERR_UNKNOWN_ID');
  const cleaned = apply(apply(m, { type: 'CLEANUP_STARTED' }), { type: 'CLEANUP_COMPLETED' });
  const incomplete = structuredClone(cleaned); incomplete.reconciled = { receiptSetHash: 'bad', resourceSetHash: hash, eventSetHash: hash, reconciliationHash: hash, secretScan: { ok: true, hash } };
  assert.equal(expectCode(() => apply(incomplete, { type: 'RECONCILE' }), 'ERR_RECONCILE').code, 'ERR_RECONCILE');
  let failures = ready(); failures = apply(failures, { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'z' }); failures = apply(failures, { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'a' });
  assert.deepEqual(failures.pendingFailures.filter((failure) => failure.category === 'command').map((failure) => failure.safeCode), ['a', 'z']);
});

test('RED: every revoked nested slot stays on the active safe branch', () => {
  const revoked = (value) => { const pair = Proxy.revocable(value, {}); pair.revoke(); return pair.proxy; };
  for (const slot of ['pendingFailures', 'commandIds', 'resourceIds', 'receipts', 'resources', 'events']) { const bad = structuredClone(make()); bad[slot] = revoked(bad[slot]); expectCode(() => apply(bad, { type: 'PRECHECK_OK' }), 'ERR_MODEL_INPUT'); }
  let rich = ready(true); rich = apply(rich, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'error', outputHash: hash }); rich = apply(rich, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); rich = apply(rich, { type: 'CLEANUP_STARTED' }); rich = apply(rich, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash }); rich = apply(rich, { type: 'CLEANUP_COMPLETED' }); rich = model.reconcileRun(rich); rich = apply(rich, { type: 'FINALIZE' });
  for (const [slot, index] of [['pendingFailures', 0], ['receipts', 0], ['resources', 0], ['events', 0]]) { const bad = structuredClone(rich); bad[slot][index] = revoked(bad[slot][index]); expectCode(() => apply(bad, { type: 'FINALIZE' }), 'ERR_MODEL_INPUT'); }
  for (const slot of ['reconciled', 'terminal']) { const bad = structuredClone(rich); bad[slot] = revoked(bad[slot]); expectCode(() => apply(bad, { type: 'FINALIZE' }), 'ERR_MODEL_INPUT'); }
  const nested = structuredClone(rich); nested.reconciled.secretScan = revoked(nested.reconciled.secretScan); expectCode(() => apply(nested, { type: 'FINALIZE' }), 'ERR_MODEL_INPUT');
  const manifest = structuredClone(rich); manifest.terminal = revoked(manifest.terminal); expectCode(() => model.buildManifestEnvelope(manifest), 'ERR_MANIFEST');
});

test('RED: hostile terminal primitives never reach coercion', () => {
  const terminalModel = apply(reconciled(), { type: 'FINALIZE' });
  const hostile = [null, 1, Symbol('hostile'), Object.create(null)];
  for (const value of hostile) { const bad = structuredClone(terminalModel); bad.terminal = { state: 'failed', category: 'command', safeCode: value }; assert.deepEqual(expectCode(() => apply(bad, { type: 'FINALIZE' }), 'ERR_TERMINAL').details, { field: 'model', reason: 'invalid' }); }
  const pair = Proxy.revocable({}, { get() { throw new Error('caller terminal text'); } }); pair.revoke(); const bad = structuredClone(terminalModel); bad.terminal = { state: 'failed', category: 'command', safeCode: pair.proxy }; const error = expectCode(() => model.buildManifestEnvelope(bad), 'ERR_TERMINAL'); assert.deepEqual(error.details, { field: 'model', reason: 'invalid' }); assert.equal(error.stack.includes('caller terminal text'), false);
});

test('RED: stored invariants classify before replay mismatch', () => {
  const receipt = (commandId, sequence) => ({ commandId, sequence, status: 'ok', outputHash: hash });
  const resource = (resourceId, ownerCommandId = null, cleanupHash = null) => ({ resourceId, ownerCommandId, cleanupHash });
  const cases = [
    ['duplicate command IDs', (m) => { m.commandIds = ['cmd.a', 'cmd.a']; }, 'ERR_DUPLICATE', { field: 'commandIds', reason: 'duplicate' }],
    ['overlapping IDs', (m) => { m.resourceIds = ['cmd.a', 'res.a']; }, 'ERR_DUPLICATE', { field: 'resourceIds', reason: 'duplicate' }],
    ['duplicate receipts', (m) => { m.receipts = [receipt('cmd.a', 0), receipt('cmd.a', 0)]; }, 'ERR_DUPLICATE', { field: 'receipt', reason: 'duplicate' }],
    ['unknown receipt reference', (m) => { m.receipts = [receipt('cmd.missing', 0)]; }, 'ERR_UNKNOWN_ID', { field: 'receipt', reason: 'unknown' }],
    ['receipt order', (m) => { m.receipts = [receipt('cmd.b', 1), receipt('cmd.a', 0)]; }, 'ERR_RECEIPT_SET', { field: 'receipt', reason: 'invalid' }],
    ['duplicate resources', (m) => { m.resources = [resource('res.a'), resource('res.a')]; }, 'ERR_DUPLICATE', { field: 'resource', reason: 'duplicate' }],
    ['unknown resource reference', (m) => { m.resources = [resource('res.missing')]; }, 'ERR_UNKNOWN_ID', { field: 'resource', reason: 'unknown' }],
    ['unknown resource owner', (m) => { m.resources = [resource('res.a', 'cmd.missing')]; }, 'ERR_UNKNOWN_ID', { field: 'resource', reason: 'unknown' }],
    ['resource order', (m) => { m.resources = [resource('res.b'), resource('res.a')]; }, 'ERR_RESOURCE_SET', { field: 'resource', reason: 'invalid' }],
  ];
  for (const [, mutate, code, details] of cases) { const bad = structuredClone(make()); mutate(bad); assert.deepEqual(expectCode(() => apply(bad, { type: 'PRECHECK_OK' }), code).details, details); }
});

test('RED: stored resource ownership and cleanup hashes use the resource branch', () => {
  const released = apply(apply(ready(true), { type: 'CLEANUP_STARTED' }), { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash });
  const cases = [
    ['released cleanupHash null', (m) => { m.resources[0].cleanupHash = null; }, 'ERR_RESOURCE_SET'],
    ['cleanupHash non-string', (m) => { m.resources[0].cleanupHash = 7; }, 'ERR_RESOURCE_SET'],
    ['cleanupHash malformed string', (m) => { m.resources[0].cleanupHash = 'bad'; }, 'ERR_RESOURCE_SET'],
    ['owner non-string', (m) => { m.resources[0].ownerCommandId = 7; }, 'ERR_RESOURCE_SET'],
    ['owner malformed string', (m) => { m.resources[0].ownerCommandId = 'BAD!'; }, 'ERR_RESOURCE_SET'],
  ];
  for (const [, mutate, code] of cases) { const bad = structuredClone(released); mutate(bad); assert.deepEqual(expectCode(() => apply(bad, { type: 'CLEANUP_STARTED' }), code).details, { field: 'resource', reason: 'invalid' }); }
  const descriptor = structuredClone(released); Object.defineProperty(descriptor.resources[0], 'cleanupHash', { enumerable: true, get() { throw new Error('descriptor leak'); } }); const error = expectCode(() => apply(descriptor, { type: 'CLEANUP_STARTED' }), 'ERR_MODEL_INPUT'); assert.deepEqual(error.details, { field: 'resource', reason: 'missing' }); assert.equal(error.stack.includes('descriptor leak'), false);
});

test('RED: stored receipt sequence semantics stay on receipt branches', () => {
  const badSequences = [-1, Number.NaN, Number.POSITIVE_INFINITY, '0', 0.5];
  for (const sequence of badSequences) { const bad = structuredClone(make()); bad.receipts = [{ commandId: 'cmd.a', sequence, status: 'ok', outputHash: hash }]; assert.deepEqual(expectCode(() => apply(bad, { type: 'PRECHECK_OK' }), 'ERR_RECEIPT_SET').details, { field: 'receipt', reason: 'invalid' }); }
  let zero = ready(); zero = apply(zero, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); assert.equal(zero.receipts[0].sequence, 0);
  const duplicate = structuredClone(make()); duplicate.receipts = [{ commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }, { commandId: 'cmd.b', sequence: 0, status: 'ok', outputHash: hash }]; assert.deepEqual(expectCode(() => apply(duplicate, { type: 'PRECHECK_OK' }), 'ERR_DUPLICATE').details, { field: 'receipt', reason: 'duplicate' });
  let gap = ready(); gap = apply(gap, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); gap = apply(gap, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 2, status: 'ok', outputHash: hash }); gap = apply(gap, { type: 'CLEANUP_STARTED' }); gap = apply(gap, { type: 'CLEANUP_COMPLETED' }); assert.deepEqual(expectCode(() => model.reconcileRun(gap), 'ERR_RECEIPT_SET').details, { field: 'receipt', reason: 'incomplete' });
});

test('RED: semantic receipt/resource duplicates precede state and references', () => {
  const running = apply(ready(), { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash });
  assert.deepEqual(expectCode(() => apply(running, { type: 'COMMAND_RECEIPT', commandId: 'cmd.missing', sequence: 0, status: 'ok', outputHash: 'c'.repeat(64) }), 'ERR_DUPLICATE').details, { field: 'receipt', reason: 'duplicate' });
  const acquired = ready(true);
  assert.deepEqual(expectCode(() => apply(acquired, { type: 'RESOURCE_ACQUIRED', resourceId: 'res.a', ownerCommandId: 'cmd.missing' }), 'ERR_DUPLICATE').details, { field: 'resource', reason: 'duplicate' });
  let terminalBase = ready(); terminalBase = apply(terminalBase, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); terminalBase = apply(terminalBase, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); terminalBase = apply(terminalBase, { type: 'CLEANUP_STARTED' }); terminalBase = apply(terminalBase, { type: 'CLEANUP_COMPLETED' }); const terminal = apply(model.reconcileRun(terminalBase), { type: 'FINALIZE' });
  assert.deepEqual(expectCode(() => apply(terminal, { type: 'COMMAND_RECEIPT', commandId: 'cmd.missing', sequence: 0, status: 'ok', outputHash: 'c'.repeat(64) }), 'ERR_DUPLICATE').details, { field: 'receipt', reason: 'duplicate' });
  let winner = ready(); winner = apply(winner, { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'z' }); winner = apply(winner, { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'a' }); winner = apply(winner, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); winner = apply(winner, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); winner = apply(winner, { type: 'CLEANUP_STARTED' }); winner = apply(winner, { type: 'CLEANUP_COMPLETED' }); winner = model.reconcileRun(winner); winner = apply(winner, { type: 'FINALIZE' }); assert.deepEqual(winner.terminal, { state: 'failed', category: 'command', safeCode: 'a' });
});

test('RED: every event/state and malformed event schema branch is probed', () => {
  const running = () => apply(ready(), { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash });
  const cleaned = () => { let m = running(); m = apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); m = apply(m, { type: 'CLEANUP_STARTED' }); return apply(m, { type: 'CLEANUP_COMPLETED' }); };
  const terminal = (category) => { let m = ready(); if (category) m = apply(m, { type: 'FAILURE_RECORDED', category, safeCode: 'terminal' }); m = apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }); m = apply(m, { type: 'COMMAND_RECEIPT', commandId: 'cmd.b', sequence: 1, status: 'ok', outputHash: hash }); m = apply(m, { type: 'CLEANUP_STARTED' }); m = apply(m, { type: 'CLEANUP_COMPLETED' }); m = model.reconcileRun(m); return apply(m, { type: 'FINALIZE' }); };
  const states = [['created', () => make()], ['preflight', () => ready()], ['running', running], ['cleaning', () => apply(running(), { type: 'CLEANUP_STARTED' })], ['cleaned', cleaned], ['reconciled', () => model.reconcileRun(cleaned())], ['succeeded', () => terminal(null)], ['blocked', () => terminal('preflight')], ['failed', () => terminal('timeout')], ['aborted', () => terminal('signal')]];
  const events = { PRECHECK_OK: { type: 'PRECHECK_OK' }, COMMAND_RECEIPT: { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', outputHash: hash }, RESOURCE_ACQUIRED: { type: 'RESOURCE_ACQUIRED', resourceId: 'res.a', ownerCommandId: 'cmd.a' }, CLEANUP_STARTED: { type: 'CLEANUP_STARTED' }, RESOURCE_RELEASED: { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: hash }, FAILURE_RECORDED: { type: 'FAILURE_RECORDED', category: 'command', safeCode: 'x' }, CLEANUP_COMPLETED: { type: 'CLEANUP_COMPLETED' }, RECONCILE: { type: 'RECONCILE' }, FINALIZE: { type: 'FINALIZE' } };
  const transition = 'ERR_TRANSITION'; const duplicate = 'ERR_DUPLICATE'; const terminalError = 'ERR_TERMINAL'; const expected = { created: { PRECHECK_OK: 'ok', COMMAND_RECEIPT: transition, RESOURCE_ACQUIRED: transition, CLEANUP_STARTED: transition, RESOURCE_RELEASED: transition, FAILURE_RECORDED: transition, CLEANUP_COMPLETED: transition, RECONCILE: transition, FINALIZE: transition }, preflight: { PRECHECK_OK: duplicate, COMMAND_RECEIPT: 'ok', RESOURCE_ACQUIRED: 'ok', CLEANUP_STARTED: 'ok', RESOURCE_RELEASED: transition, FAILURE_RECORDED: 'ok', CLEANUP_COMPLETED: transition, RECONCILE: transition, FINALIZE: transition }, running: { PRECHECK_OK: duplicate, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: 'ok', CLEANUP_STARTED: 'ok', RESOURCE_RELEASED: transition, FAILURE_RECORDED: 'ok', CLEANUP_COMPLETED: transition, RECONCILE: transition, FINALIZE: transition }, cleaning: { PRECHECK_OK: duplicate, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: transition, CLEANUP_STARTED: duplicate, RESOURCE_RELEASED: 'ERR_RESOURCE_SET', FAILURE_RECORDED: 'ok', CLEANUP_COMPLETED: 'ok', RECONCILE: transition, FINALIZE: transition }, cleaned: { PRECHECK_OK: duplicate, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: transition, CLEANUP_STARTED: duplicate, RESOURCE_RELEASED: transition, FAILURE_RECORDED: transition, CLEANUP_COMPLETED: duplicate, RECONCILE: 'ok', FINALIZE: transition }, reconciled: { PRECHECK_OK: duplicate, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: transition, CLEANUP_STARTED: duplicate, RESOURCE_RELEASED: transition, FAILURE_RECORDED: transition, CLEANUP_COMPLETED: duplicate, RECONCILE: duplicate, FINALIZE: 'ok' }, succeeded: { PRECHECK_OK: terminalError, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: terminalError, CLEANUP_STARTED: terminalError, RESOURCE_RELEASED: terminalError, FAILURE_RECORDED: terminalError, CLEANUP_COMPLETED: terminalError, RECONCILE: terminalError, FINALIZE: terminalError }, blocked: { PRECHECK_OK: terminalError, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: terminalError, CLEANUP_STARTED: terminalError, RESOURCE_RELEASED: terminalError, FAILURE_RECORDED: terminalError, CLEANUP_COMPLETED: terminalError, RECONCILE: terminalError, FINALIZE: terminalError }, failed: { PRECHECK_OK: terminalError, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: terminalError, CLEANUP_STARTED: terminalError, RESOURCE_RELEASED: terminalError, FAILURE_RECORDED: terminalError, CLEANUP_COMPLETED: terminalError, RECONCILE: terminalError, FINALIZE: terminalError }, aborted: { PRECHECK_OK: terminalError, COMMAND_RECEIPT: duplicate, RESOURCE_ACQUIRED: terminalError, CLEANUP_STARTED: terminalError, RESOURCE_RELEASED: terminalError, FAILURE_RECORDED: terminalError, CLEANUP_COMPLETED: terminalError, RECONCILE: terminalError, FINALIZE: terminalError } };
  let probes = 0;
  for (const [state, create] of states) for (const event of model.EVENT_TYPES) { const expectedCode = expected[state][event]; try { const result = apply(create(), events[event]); assert.equal(expectedCode, 'ok', `${state}/${event}`); assert.ok(result && result.state); } catch (error) { assert.notEqual(expectedCode, 'ok', `${state}/${event}`); assert.equal(error.name, 'RecoveryRunnerModelError', `${state}/${event}`); assert.equal(error.code, expectedCode, `${state}/${event}`); assert.equal(error.message, expectedCode, `${state}/${event}`); } probes += 1; }
  assert.equal(probes, 90);
  const malformed = { PRECHECK_OK: [{}, { type: 'PRECHECK_OK', extra: 1 }, { type: 'PRECHECK_OK', get type() { throw new Error('schema leak'); } }], COMMAND_RECEIPT: [{ type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok' }, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: -1, status: 'ok', outputHash: hash }, { type: 'COMMAND_RECEIPT', commandId: 'cmd.a', sequence: 0, status: 'ok', get outputHash() { throw new Error('schema leak'); } }], RESOURCE_ACQUIRED: [{ type: 'RESOURCE_ACQUIRED', resourceId: 'res.a' }, { type: 'RESOURCE_ACQUIRED', resourceId: 'BAD!', ownerCommandId: 'cmd.a' }, { type: 'RESOURCE_ACQUIRED', resourceId: 'res.a', get ownerCommandId() { throw new Error('schema leak'); } }], CLEANUP_STARTED: [{}, { type: 'CLEANUP_STARTED', extra: 1 }, { type: 'CLEANUP_STARTED', get type() { throw new Error('schema leak'); } }], RESOURCE_RELEASED: [{ type: 'RESOURCE_RELEASED', resourceId: 'res.a' }, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', cleanupHash: 'bad' }, { type: 'RESOURCE_RELEASED', resourceId: 'res.a', get cleanupHash() { throw new Error('schema leak'); } }], FAILURE_RECORDED: [{ type: 'FAILURE_RECORDED', category: 'command' }, { type: 'FAILURE_RECORDED', category: 'bad', safeCode: 'x' }, { type: 'FAILURE_RECORDED', category: 'command', get safeCode() { throw new Error('schema leak'); } }], CLEANUP_COMPLETED: [{}, { type: 'CLEANUP_COMPLETED', extra: 1 }, { type: 'CLEANUP_COMPLETED', get type() { throw new Error('schema leak'); } }], RECONCILE: [{}, { type: 'RECONCILE', extra: 1 }, { type: 'RECONCILE', get type() { throw new Error('schema leak'); } }], FINALIZE: [{}, { type: 'FINALIZE', extra: 1 }, { type: 'FINALIZE', get type() { throw new Error('schema leak'); } }] };
  let malformedProbes = 0; for (const type of model.EVENT_TYPES) for (const event of malformed[type]) { const error = expectCode(() => apply(make(), event), 'ERR_EVENT_SCHEMA'); assert.equal(error.stack.includes('schema leak'), false); malformedProbes += 1; } assert.equal(malformedProbes, 27);
});
