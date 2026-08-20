import { canonicalJson, sha256Hex, assertRuntimeToken, scanSecrets } from './recovery-harness-lib.mjs';

export const RUN_STATES = Object.freeze(['created', 'preflight', 'running', 'cleaning', 'cleaned', 'reconciled', 'succeeded', 'blocked', 'failed', 'aborted']);
export const EVENT_TYPES = Object.freeze(['PRECHECK_OK', 'COMMAND_RECEIPT', 'RESOURCE_ACQUIRED', 'CLEANUP_STARTED', 'RESOURCE_RELEASED', 'FAILURE_RECORDED', 'CLEANUP_COMPLETED', 'RECONCILE', 'FINALIZE']);
export const FAILURE_PRECEDENCE = Object.freeze([
  ['secret', 'blocked'], ['cleanup', 'failed'], ['signal', 'aborted'], ['timeout', 'failed'], ['command', 'failed'], ['preflight', 'blocked'],
].map(([category, terminal]) => Object.freeze({ category, terminal })));

const SCHEMA = 'actravel.recovery-run-model/v1';
const INTERPRETATION = 'orchestration-only-not-recovery-evidence';
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const HASH = /^[0-9a-f]{64}$/;
const STATES = new Set(RUN_STATES);
const TYPES = new Set(EVENT_TYPES);
const STATUS = new Set(['ok', 'error', 'timeout', 'signal']);
const CATEGORIES = new Set(FAILURE_PRECEDENCE.map((x) => x.category));
const TERMINALS = new Set(['succeeded', 'blocked', 'failed', 'aborted']);
const MODEL_KEYS = ['schema', 'runId', 'parentTokenHash', 'interpretation', 'state', 'pendingFailures', 'commandIds', 'resourceIds', 'receipts', 'resources', 'events', 'reconciled', 'terminal'];
const EVENT_KEYS = {
  PRECHECK_OK: ['type'], CLEANUP_STARTED: ['type'], CLEANUP_COMPLETED: ['type'], RECONCILE: ['type'], FINALIZE: ['type'],
  COMMAND_RECEIPT: ['type', 'commandId', 'sequence', 'status', 'outputHash'], RESOURCE_ACQUIRED: ['type', 'resourceId', 'ownerCommandId'],
  RESOURCE_RELEASED: ['type', 'resourceId', 'cleanupHash'], FAILURE_RECORDED: ['type', 'category', 'safeCode'],
};

class RecoveryRunnerModelError extends Error {
  constructor(code, details) { super(code); this.name = 'RecoveryRunnerModelError'; this.code = code; this.details = Object.freeze(details); Object.freeze(this); }
}
function fail(code, field, reason, extra = {}) { const details = { field, reason }; if (Number.isSafeInteger(extra.index) && extra.index >= 0) details.index = extra.index; if (typeof extra.id === 'string' && ID.test(extra.id)) details.id = extra.id; if (typeof extra.eventType === 'string' && TYPES.has(extra.eventType)) details.eventType = extra.eventType; throw new RecoveryRunnerModelError(code, details); }
function safe(code, field, reason, extra = {}) { try { fail(code, field, reason, extra); } catch (error) { if (error instanceof RecoveryRunnerModelError) throw error; fail(code, field, reason); } }
function own(value, key, code, field) {
  let descriptor;
  try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { safe(code, field, 'invalid'); }
  if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) safe(code, field, 'missing');
  return descriptor.value;
}
function exact(value, wanted, code, field, trapCode = code) {
  if (value === null || typeof value !== 'object') safe(code, field, 'invalid');
  let prototype; let keys;
  try { prototype = Object.getPrototypeOf(value); keys = Reflect.ownKeys(value); } catch { safe(trapCode, field, 'invalid'); }
  if (![Object.prototype, null].includes(prototype)) safe(code, field, 'invalid');
  if (keys.length !== wanted.length || keys.some((key) => typeof key !== 'string' || !wanted.includes(key))) safe(code, field, 'invalid');
  for (const key of wanted) own(value, key, trapCode, field);
}
function array(value, code, field) {
  let isArray;
  try { isArray = Array.isArray(value); } catch { safe(code, field, 'invalid'); }
  if (!isArray) safe(code, field, 'invalid');
  let length; let keys;
  try { length = ownLength(value); keys = Reflect.ownKeys(value); } catch { safe(code, field, 'invalid'); }
  if (keys.length !== length + 1 || !keys.includes('length')) safe(code, field, 'invalid');
  const result = [];
  for (let index = 0; index < length; index += 1) result.push(own(value, String(index), code, field));
  return result;
}
function ownLength(value) { const d = Object.getOwnPropertyDescriptor(value, 'length'); if (!d || !Object.hasOwn(d, 'value') || !Number.isSafeInteger(d.value) || d.value < 0) throw new Error('invalid'); return d.value; }
function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return value;
  seen.add(value); for (const key of Reflect.ownKeys(value)) freeze(value[key], seen); return Object.freeze(value);
}
function scan(text, code, field) { try { if (!scanSecrets(text).ok) safe('ERR_SECRET', field, 'secret'); } catch (error) { if (error instanceof RecoveryRunnerModelError) throw error; safe(code, field, 'invalid'); } }
function id(value, field, code = 'ERR_MODEL_INPUT') { if (typeof value !== 'string' || !ID.test(value)) safe(code, field, 'invalid'); scan(value, code, field); return value; }
function hash(value, field, code) { if (typeof value !== 'string' || !HASH.test(value)) safe(code, field, 'invalid'); scan(value, code, field); return value; }
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function failureCompare(a, b) { return precedence(a.category) - precedence(b.category) || compare(a.safeCode, b.safeCode); }
function precedence(category) { return FAILURE_PRECEDENCE.findIndex((x) => x.category === category); }
function sortedUnique(values, field) { const out = [...values].sort(compare); if (new Set(out).size !== out.length) safe('ERR_DUPLICATE', field, 'duplicate'); return out; }

function optionsSnapshot(input) {
  exact(input, ['runId', 'parentToken', 'commandIds', 'resourceIds'], 'ERR_MODEL_INPUT', 'options');
  const runId = id(own(input, 'runId', 'ERR_MODEL_INPUT', 'options'), 'options');
  const token = own(input, 'parentToken', 'ERR_MODEL_INPUT', 'options');
  try { assertRuntimeToken(token); } catch { safe('ERR_MODEL_INPUT', 'options', 'invalid'); }
  const commands = array(own(input, 'commandIds', 'ERR_MODEL_INPUT', 'options'), 'ERR_MODEL_INPUT', 'commandIds');
  const resources = array(own(input, 'resourceIds', 'ERR_MODEL_INPUT', 'options'), 'ERR_MODEL_INPUT', 'resourceIds');
  commands.forEach((x) => id(x, 'commandIds')); resources.forEach((x) => id(x, 'resourceIds'));
  const commandIds = sortedUnique(commands, 'commandIds'); const resourceIds = sortedUnique(resources, 'resourceIds');
  if (commandIds.some((value) => resourceIds.includes(value))) safe('ERR_DUPLICATE', 'resourceIds', 'duplicate');
  return { runId, token, commandIds, resourceIds };
}
function eventSnapshot(input, code = 'ERR_EVENT_SCHEMA') {
  if (input === null || typeof input !== 'object') safe(code, 'event', 'invalid');
  const type = own(input, 'type', code, 'event'); if (!TYPES.has(type)) safe(code, 'event', 'invalid'); exact(input, EVENT_KEYS[type], code, 'event'); const out = { type };
  for (const key of EVENT_KEYS[type].slice(1)) out[key] = own(input, key, code, key === 'commandId' ? 'receipt' : key === 'resourceId' || key === 'ownerCommandId' || key === 'cleanupHash' ? 'resource' : key === 'safeCode' || key === 'category' ? 'failure' : 'receipt');
  if (type === 'COMMAND_RECEIPT') { id(out.commandId, 'receipt', code); if (!Number.isSafeInteger(out.sequence) || out.sequence < 0 || !STATUS.has(out.status)) safe(code, 'receipt', 'invalid'); hash(out.outputHash, 'receipt', code); }
  if (type === 'RESOURCE_ACQUIRED') { id(out.resourceId, 'resource', code); id(out.ownerCommandId, 'resource', code); }
  if (type === 'RESOURCE_RELEASED') { id(out.resourceId, 'resource', code); hash(out.cleanupHash, 'resource', code); }
  if (type === 'FAILURE_RECORDED') { if (!CATEGORIES.has(out.category)) safe(code, 'failure', 'invalid'); id(out.safeCode, 'failure', code); }
  return out;
}
function failureSnapshot(value, code = 'ERR_MODEL_INPUT') { exact(value, ['category', 'safeCode'], code, 'failure'); const category = own(value, 'category', code, 'failure'); const safeCode = own(value, 'safeCode', code, 'failure'); if (!CATEGORIES.has(category)) safe(code, 'failure', 'invalid'); id(safeCode, 'failure', code); return { category, safeCode }; }
function receiptSnapshot(value, code = 'ERR_MODEL_INPUT') { exact(value, ['commandId', 'sequence', 'status', 'outputHash'], code, 'receipt'); const r = { commandId: own(value, 'commandId', code, 'receipt'), sequence: own(value, 'sequence', code, 'receipt'), status: own(value, 'status', code, 'receipt'), outputHash: own(value, 'outputHash', code, 'receipt') }; id(r.commandId, 'receipt', code); if (!Number.isSafeInteger(r.sequence) || r.sequence < 0 || !STATUS.has(r.status)) safe('ERR_RECEIPT_SET', 'receipt', 'invalid'); hash(r.outputHash, 'receipt', 'ERR_RECEIPT_SET'); return r; }
function resourceSnapshot(value, code = 'ERR_MODEL_INPUT') { exact(value, ['resourceId', 'ownerCommandId', 'cleanupHash'], code, 'resource'); const r = { resourceId: own(value, 'resourceId', code, 'resource'), ownerCommandId: own(value, 'ownerCommandId', code, 'resource'), cleanupHash: own(value, 'cleanupHash', code, 'resource') }; id(r.resourceId, 'resource', code); if (r.ownerCommandId !== null) { if (typeof r.ownerCommandId !== 'string') safe('ERR_RESOURCE_SET', 'resource', 'invalid'); id(r.ownerCommandId, 'resource', 'ERR_RESOURCE_SET'); } if (r.cleanupHash !== null) { if (typeof r.cleanupHash !== 'string') safe('ERR_RESOURCE_SET', 'resource', 'invalid'); hash(r.cleanupHash, 'resource', 'ERR_RESOURCE_SET'); } if (r.ownerCommandId === null && r.cleanupHash !== null) safe('ERR_RESOURCE_SET', 'resource', 'invalid'); return r; }
function list(value, item, code, field) { return array(value, code, field).map((x) => item(x, code)); }

function addFailure(model, failure, automatic = false) {
  if (model.pendingFailures.some((x) => x.category === failure.category && x.safeCode === failure.safeCode)) { if (automatic) return model.pendingFailures; safe('ERR_DUPLICATE', 'failure', 'duplicate'); }
  return [...model.pendingFailures, failure].sort(failureCompare);
}
function next(model, changes, event, state = model.state) { return { ...model, ...changes, state, events: [...model.events, event] }; }
function reconcileInternal(model) {
  if (model.state !== 'cleaned') safe('ERR_TRANSITION', 'event', 'not_allowed');
  const receipts = [...model.receipts].sort((a, b) => a.sequence - b.sequence);
  if (receipts.length !== model.commandIds.length || receipts.some((x, i) => x.sequence !== i || !model.commandIds.includes(x.commandId)) || new Set(receipts.map((x) => x.commandId)).size !== receipts.length) safe('ERR_RECEIPT_SET', 'receipt', 'incomplete');
  const resources = [...model.resources].sort((a, b) => compare(a.resourceId, b.resourceId));
  if (resources.length !== model.resourceIds.length || resources.some((x, i) => x.resourceId !== model.resourceIds[i] || (x.ownerCommandId !== null && x.cleanupHash === null))) safe('ERR_RESOURCE_SET', 'resource', 'incomplete');
  const finalEvents = [...model.events, { type: 'RECONCILE' }, { type: 'FINALIZE' }];
  const strings = [canonicalJson(finalEvents), canonicalJson(receipts), canonicalJson(resources)];
  try { if (!scanSecrets([...strings, canonicalJson(model.pendingFailures)]).ok) safe('ERR_SECRET', 'model', 'secret');
    const receiptSetHash = sha256Hex(strings[1]); const resourceSetHash = sha256Hex(strings[2]); const eventSetHash = sha256Hex(strings[0]); const secretScan = { ok: true, hash: sha256Hex(canonicalJson(strings)) };
    const reconciliationHash = sha256Hex(canonicalJson({ receiptSetHash, resourceSetHash, eventSetHash, secretScan }));
    return next(model, { receipts, resources, reconciled: { receiptSetHash, resourceSetHash, eventSetHash, reconciliationHash, secretScan } }, { type: 'RECONCILE' }, 'reconciled');
  } catch (error) { if (error instanceof RecoveryRunnerModelError) throw error; safe('ERR_RECONCILE', 'model', 'invalid'); }
}
function reduce(model, event) {
  if ((event.type === 'COMMAND_RECEIPT' && model.receipts.some((x) => x.commandId === event.commandId || x.sequence === event.sequence)) || (event.type === 'RESOURCE_ACQUIRED' && model.resources.some((x) => x.resourceId === event.resourceId && x.ownerCommandId !== null)) || (event.type === 'RESOURCE_RELEASED' && model.resources.some((x) => x.resourceId === event.resourceId && x.cleanupHash !== null))) safe('ERR_DUPLICATE', event.type.includes('RECEIPT') ? 'receipt' : 'resource', 'duplicate');
  if (TERMINALS.has(model.state)) safe('ERR_TERMINAL', 'model', 'not_allowed');
  if (model.events.some((x) => canonicalJson(x) === canonicalJson(event))) safe('ERR_DUPLICATE', 'event', 'duplicate');
  if (event.type === 'RECONCILE') return reconcileInternal(model);
  if (event.type === 'PRECHECK_OK' && model.state === 'created') return next(model, {}, event, 'preflight');
  if ((event.type === 'COMMAND_RECEIPT' || event.type === 'RESOURCE_ACQUIRED') && ['preflight', 'running'].includes(model.state)) {
    if (event.type === 'COMMAND_RECEIPT') { if (!model.commandIds.includes(event.commandId)) safe('ERR_UNKNOWN_ID', 'receipt', 'unknown'); if (model.receipts.some((x) => x.commandId === event.commandId || x.sequence === event.sequence)) safe('ERR_DUPLICATE', 'receipt', 'duplicate'); const receipt = { commandId: event.commandId, sequence: event.sequence, status: event.status, outputHash: event.outputHash }; const auto = event.status === 'ok' ? model.pendingFailures : { category: event.status === 'error' ? 'command' : event.status, safeCode: `receipt-${event.status}` }; return next(model, { receipts: [...model.receipts, receipt].sort((a, b) => a.sequence - b.sequence), pendingFailures: event.status === 'ok' ? model.pendingFailures : addFailure(model, auto, true) }, event, model.state === 'preflight' ? 'running' : model.state); }
    if (!model.resourceIds.includes(event.resourceId) || !model.commandIds.includes(event.ownerCommandId)) safe('ERR_UNKNOWN_ID', 'resource', 'unknown'); const resource = model.resources.find((x) => x.resourceId === event.resourceId); if (resource.ownerCommandId !== null) safe('ERR_DUPLICATE', 'resource', 'duplicate'); return next(model, { resources: model.resources.map((x) => x.resourceId === event.resourceId ? { ...x, ownerCommandId: event.ownerCommandId } : x) }, event, model.state === 'preflight' ? 'running' : model.state);
  }
  if (event.type === 'CLEANUP_STARTED' && ['preflight', 'running'].includes(model.state)) return next(model, {}, event, 'cleaning');
  if (event.type === 'FAILURE_RECORDED' && ['preflight', 'running', 'cleaning'].includes(model.state) && (event.category !== 'cleanup' || model.state === 'cleaning')) return next(model, { pendingFailures: addFailure(model, { category: event.category, safeCode: event.safeCode }) }, event);
  if (event.type === 'RESOURCE_RELEASED' && model.state === 'cleaning') { const resource = model.resources.find((x) => x.resourceId === event.resourceId); if (!resource) safe('ERR_UNKNOWN_ID', 'resource', 'unknown'); if (resource.ownerCommandId === null) safe('ERR_RESOURCE_SET', 'resource', 'incomplete'); if (resource.cleanupHash !== null) safe('ERR_DUPLICATE', 'resource', 'duplicate'); return next(model, { resources: model.resources.map((x) => x.resourceId === event.resourceId ? { ...x, cleanupHash: event.cleanupHash } : x) }, event); }
  if (event.type === 'CLEANUP_COMPLETED' && model.state === 'cleaning') { if (model.resources.some((x) => x.ownerCommandId !== null && x.cleanupHash === null)) safe('ERR_RESOURCE_SET', 'resource', 'incomplete'); return next(model, {}, event, 'cleaned'); }
  if (event.type === 'FINALIZE' && model.state === 'reconciled') { const failure = model.pendingFailures[0]; const terminal = failure ? { state: FAILURE_PRECEDENCE[precedence(failure.category)].terminal, category: failure.category, safeCode: failure.safeCode } : { state: 'succeeded', category: null, safeCode: null }; return next(model, { terminal }, event, terminal.state); }
  safe('ERR_TRANSITION', 'event', 'not_allowed', { eventType: event.type });
}

function skeleton(runId, parentTokenHash, commandIds, resourceIds) { return { schema: SCHEMA, runId, parentTokenHash, interpretation: INTERPRETATION, state: 'created', pendingFailures: [], commandIds, resourceIds, receipts: [], resources: resourceIds.map((resourceId) => ({ resourceId, ownerCommandId: null, cleanupHash: null })), events: [], reconciled: null, terminal: null }; }
function validateModel(input) {
  exact(input, MODEL_KEYS, 'ERR_MODEL_INPUT', 'model');
  const raw = { schema: own(input, 'schema', 'ERR_MODEL_INPUT', 'model'), runId: own(input, 'runId', 'ERR_MODEL_INPUT', 'model'), parentTokenHash: own(input, 'parentTokenHash', 'ERR_MODEL_INPUT', 'model'), interpretation: own(input, 'interpretation', 'ERR_MODEL_INPUT', 'model'), state: own(input, 'state', 'ERR_MODEL_INPUT', 'model'), pendingFailures: null, commandIds: null, resourceIds: null, receipts: null, resources: null, events: null, reconciled: null, terminal: null };
  if (!STATES.has(raw.state)) safe('ERR_TRANSITION', 'model', 'invalid'); if (raw.schema !== SCHEMA || raw.interpretation !== INTERPRETATION) safe('ERR_MODEL_INPUT', 'model', 'invalid'); id(raw.runId, 'model'); hash(raw.parentTokenHash, 'model', 'ERR_MODEL_INPUT');
  raw.commandIds = array(own(input, 'commandIds', 'ERR_MODEL_INPUT', 'model'), 'ERR_MODEL_INPUT', 'commandIds'); raw.resourceIds = array(own(input, 'resourceIds', 'ERR_MODEL_INPUT', 'model'), 'ERR_MODEL_INPUT', 'resourceIds'); raw.commandIds.forEach((x) => id(x, 'commandIds')); raw.resourceIds.forEach((x) => id(x, 'resourceIds')); if (new Set(raw.commandIds).size !== raw.commandIds.length) safe('ERR_DUPLICATE', 'commandIds', 'duplicate'); if (new Set(raw.resourceIds).size !== raw.resourceIds.length) safe('ERR_DUPLICATE', 'resourceIds', 'duplicate'); if (raw.commandIds.some((x) => raw.resourceIds.includes(x))) safe('ERR_DUPLICATE', 'resourceIds', 'duplicate'); if (raw.commandIds.some((x, i) => i && compare(raw.commandIds[i - 1], x) >= 0) || raw.resourceIds.some((x, i) => i && compare(raw.resourceIds[i - 1], x) >= 0)) safe('ERR_MODEL_INPUT', 'model', 'invalid');
  raw.pendingFailures = list(own(input, 'pendingFailures', 'ERR_MODEL_INPUT', 'model'), failureSnapshot, 'ERR_MODEL_INPUT', 'failure'); if (new Set(raw.pendingFailures.map((x) => canonicalJson(x))).size !== raw.pendingFailures.length) safe('ERR_DUPLICATE', 'failure', 'duplicate'); raw.receipts = list(own(input, 'receipts', 'ERR_MODEL_INPUT', 'model'), receiptSnapshot, 'ERR_MODEL_INPUT', 'receipt'); if (new Set(raw.receipts.map((x) => x.commandId)).size !== raw.receipts.length || new Set(raw.receipts.map((x) => x.sequence)).size !== raw.receipts.length) safe('ERR_DUPLICATE', 'receipt', 'duplicate'); if (raw.receipts.some((x) => !raw.commandIds.includes(x.commandId))) safe('ERR_UNKNOWN_ID', 'receipt', 'unknown'); if (raw.receipts.some((x, i) => i && raw.receipts[i - 1].sequence >= x.sequence)) safe('ERR_RECEIPT_SET', 'receipt', 'invalid'); raw.resources = list(own(input, 'resources', 'ERR_MODEL_INPUT', 'resource'), resourceSnapshot, 'ERR_MODEL_INPUT', 'resource'); if (new Set(raw.resources.map((x) => x.resourceId)).size !== raw.resources.length) safe('ERR_DUPLICATE', 'resource', 'duplicate'); if (raw.resources.some((x) => !raw.resourceIds.includes(x.resourceId) || (x.ownerCommandId !== null && !raw.commandIds.includes(x.ownerCommandId)))) safe('ERR_UNKNOWN_ID', 'resource', 'unknown'); if (raw.resources.some((x, i) => i && compare(raw.resources[i - 1].resourceId, x.resourceId) >= 0)) safe('ERR_RESOURCE_SET', 'resource', 'invalid'); raw.events = array(own(input, 'events', 'ERR_MODEL_INPUT', 'model'), 'ERR_MODEL_INPUT', 'event').map((x) => eventSnapshot(x, 'ERR_MODEL_INPUT')); if (new Set(raw.events.map((x) => canonicalJson(x))).size !== raw.events.length) safe('ERR_DUPLICATE', 'event', 'duplicate');
  for (const resource of raw.resources) { const acquired = raw.events.find((event) => event.type === 'RESOURCE_ACQUIRED' && event.resourceId === resource.resourceId); const released = raw.events.find((event) => event.type === 'RESOURCE_RELEASED' && event.resourceId === resource.resourceId); if (resource.ownerCommandId !== null && (!acquired || acquired.ownerCommandId !== resource.ownerCommandId)) safe('ERR_RESOURCE_SET', 'resource', 'invalid'); if (resource.ownerCommandId === null && (acquired || released)) safe('ERR_RESOURCE_SET', 'resource', 'invalid'); if (resource.cleanupHash !== null && (!released || released.cleanupHash !== resource.cleanupHash)) safe('ERR_RESOURCE_SET', 'resource', 'invalid'); if (resource.cleanupHash === null && released) safe('ERR_RESOURCE_SET', 'resource', 'invalid'); }
  const reconciled = own(input, 'reconciled', 'ERR_MODEL_INPUT', 'model'); if (reconciled !== null) { exact(reconciled, ['receiptSetHash', 'resourceSetHash', 'eventSetHash', 'reconciliationHash', 'secretScan'], 'ERR_MODEL_INPUT', 'model'); const secretScan = own(reconciled, 'secretScan', 'ERR_MODEL_INPUT', 'model'); exact(secretScan, ['ok', 'hash'], 'ERR_MODEL_INPUT', 'model'); if (own(secretScan, 'ok', 'ERR_MODEL_INPUT', 'model') !== true) safe('ERR_RECONCILE', 'model', 'invalid'); raw.reconciled = { receiptSetHash: hash(own(reconciled, 'receiptSetHash', 'ERR_MODEL_INPUT', 'model'), 'model', 'ERR_RECONCILE'), resourceSetHash: hash(own(reconciled, 'resourceSetHash', 'ERR_MODEL_INPUT', 'model'), 'model', 'ERR_RECONCILE'), eventSetHash: hash(own(reconciled, 'eventSetHash', 'ERR_MODEL_INPUT', 'model'), 'model', 'ERR_RECONCILE'), reconciliationHash: hash(own(reconciled, 'reconciliationHash', 'ERR_MODEL_INPUT', 'model'), 'model', 'ERR_RECONCILE'), secretScan: { ok: true, hash: hash(own(secretScan, 'hash', 'ERR_MODEL_INPUT', 'model'), 'model', 'ERR_RECONCILE') } }; }
  const terminal = own(input, 'terminal', 'ERR_MODEL_INPUT', 'model'); if (terminal !== null) { exact(terminal, ['state', 'category', 'safeCode'], 'ERR_TERMINAL', 'model', 'ERR_MODEL_INPUT'); raw.terminal = { state: own(terminal, 'state', 'ERR_MODEL_INPUT', 'model'), category: own(terminal, 'category', 'ERR_MODEL_INPUT', 'model'), safeCode: own(terminal, 'safeCode', 'ERR_MODEL_INPUT', 'model') }; const validTerminalState = typeof raw.terminal.state === 'string' && TERMINALS.has(raw.terminal.state); const validTerminalCategory = raw.terminal.category === null || (typeof raw.terminal.category === 'string' && CATEGORIES.has(raw.terminal.category)); const validTerminalCode = raw.terminal.safeCode === null || (typeof raw.terminal.safeCode === 'string' && ID.test(raw.terminal.safeCode)); if (!validTerminalState || !validTerminalCategory || !validTerminalCode || (raw.terminal.category === null) !== (raw.terminal.safeCode === null)) safe('ERR_TERMINAL', 'model', 'invalid'); if (raw.terminal.safeCode !== null) scan(raw.terminal.safeCode, 'ERR_TERMINAL', 'model'); }
  const replay = replayModel(raw); if (canonicalJson(replay.terminal) !== canonicalJson(raw.terminal)) safe('ERR_TERMINAL', 'model', 'invalid'); if (canonicalJson(replay) !== canonicalJson(raw)) safe('ERR_MODEL_INPUT', 'model', 'invalid'); return raw;
}
function replayModel(raw) { let result = skeleton(raw.runId, raw.parentTokenHash, raw.commandIds, raw.resourceIds); for (const event of raw.events) result = reduce(result, event); return result; }

export function createRunModel(input) { const { runId, token, commandIds, resourceIds } = optionsSnapshot(input); let parentTokenHash; try { parentTokenHash = sha256Hex(token); } catch { safe('ERR_MODEL_INPUT', 'options', 'invalid'); } return freeze(skeleton(runId, parentTokenHash, commandIds, resourceIds)); }
export function applyRunEvent(input, rawEvent) { const model = validateModel(input); const event = eventSnapshot(rawEvent); return freeze(reduce(model, event)); }
export function reconcileRun(input) { return applyRunEvent(input, { type: 'RECONCILE' }); }
export function buildManifestEnvelope(input) {
  let model;
  try { model = validateModel(input); } catch (error) { if (error instanceof RecoveryRunnerModelError && ['ERR_TERMINAL', 'ERR_SECRET'].includes(error.code)) throw error; if (error instanceof RecoveryRunnerModelError) safe('ERR_MANIFEST', 'manifest', 'invalid'); safe('ERR_MANIFEST', 'manifest', 'invalid'); }
  if (!TERMINALS.has(model.state) || !model.terminal || !model.reconciled) safe('ERR_TERMINAL', 'model', 'not_terminal');
  const expected = reconcileAttestations(model); if (canonicalJson(expected) !== canonicalJson(model.reconciled) || sha256Hex(canonicalJson(model.events)) !== model.reconciled.eventSetHash) safe('ERR_MANIFEST', 'manifest', 'invalid');
  const trace = ['created']; let prior = 'created'; for (const event of model.events) { const state = event.type === 'PRECHECK_OK' ? 'preflight' : ['COMMAND_RECEIPT', 'RESOURCE_ACQUIRED'].includes(event.type) ? 'running' : event.type === 'CLEANUP_STARTED' ? 'cleaning' : event.type === 'CLEANUP_COMPLETED' ? 'cleaned' : event.type === 'RECONCILE' ? 'reconciled' : event.type === 'FINALIZE' ? model.state : prior; if (state !== prior) trace.push(state); prior = state; }
  const body = { modelSchema: model.schema, runId: model.runId, parentTokenHash: model.parentTokenHash, interpretation: model.interpretation, terminal: model.terminal, commandIds: model.commandIds, resourceIds: model.resourceIds, receipts: model.receipts, resources: model.resources, events: model.events, stateTrace: trace }; const envelope = { schema: 'actravel.recovery-run-manifest/v1', body, attestations: model.reconciled };
  try { const bytes = new TextEncoder().encode(canonicalJson(envelope)); return freeze({ envelope: freeze(envelope), bytes, sha256: sha256Hex(bytes) }); } catch { safe('ERR_MANIFEST', 'manifest', 'invalid'); }
}
function reconcileAttestations(model) { const receipts = [...model.receipts].sort((a, b) => a.sequence - b.sequence); const resources = [...model.resources].sort((a, b) => compare(a.resourceId, b.resourceId)); const events = [...model.events.slice(0, -2), { type: 'RECONCILE' }, { type: 'FINALIZE' }]; const strings = [canonicalJson(events), canonicalJson(receipts), canonicalJson(resources)]; const secretScan = { ok: true, hash: sha256Hex(canonicalJson(strings)) }; const receiptSetHash = sha256Hex(strings[1]); const resourceSetHash = sha256Hex(strings[2]); const eventSetHash = sha256Hex(strings[0]); return { receiptSetHash, resourceSetHash, eventSetHash, reconciliationHash: sha256Hex(canonicalJson({ receiptSetHash, resourceSetHash, eventSetHash, secretScan })), secretScan }; }
