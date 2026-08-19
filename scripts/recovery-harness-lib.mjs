import { createHash } from 'node:crypto';
import path from 'node:path';

const PORT_KEYS = ['api', 'db', 'dbShadow', 'dbPooler', 'studio', 'inbucket', 'inbucketSmtp', 'inbucketPop3', 'analytics'];
export const REQUIRED_PORTS = Object.freeze({ api: 54321, db: 54322, dbShadow: 54320, dbPooler: 54329, studio: 54323, inbucket: 54324, inbucketSmtp: 54325, inbucketPop3: 54326, analytics: 54327 });
const errorCodes = new Set(['ERR_CONFIG_PROJECT_ID', 'ERR_CONFIG_SYNTAX', 'ERR_CONFIG_DUPLICATE', 'ERR_CONFIG_UNKNOWN', 'ERR_CONFIG_MISSING', 'ERR_CONFIG_PORT', 'ERR_CANONICAL_TYPE', 'ERR_CANONICAL_CYCLE', 'ERR_HASH_INPUT', 'ERR_SANITIZE_INPUT', 'ERR_SANITIZE_LIMIT', 'ERR_TOKEN', 'ERR_URL', 'ERR_FLAG', 'ERR_PATH', 'ERR_WORKTREE']);
const fields = new Set(['projectId', 'text', 'value', 'input', 'argv', 'env', 'url', 'path', 'entries', 'ports']);
const reasons = new Set(['invalid', 'duplicate', 'unknown', 'missing', 'out_of_range', 'unsupported', 'cycle', 'sensitive', 'outside', 'protected', 'not_allowed']);

class RecoveryHarnessError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'RecoveryHarnessError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  if (!errorCodes.has(code)) throw new Error('internal error');
  throw new RecoveryHarnessError(code, details);
}
function plain(value) { return value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function exactKeys(value, keys) { return Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)); }
function safeDetails(field, reason, extra = {}) {
  const details = {};
  if (fields.has(field)) details.field = field;
  if (reasons.has(reason)) details.reason = reason;
  if (Number.isInteger(extra.index) && extra.index >= 0) details.index = extra.index;
  if (typeof extra.path === 'string' && safePath(extra.path, extra.absolute)) details.path = extra.path;
  return details;
}
function validProjectId(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,47}$/.test(value); }

export function renderTemporarySupabaseConfig(input) {
  let keys; let projectId;
  try { if (!plain(input)) fail('ERR_CONFIG_SYNTAX', safeDetails('input', 'invalid')); keys = Reflect.ownKeys(input); projectId = input.projectId; }
  catch { fail('ERR_CONFIG_SYNTAX', safeDetails('input', 'invalid')); }
  if (keys.some((key) => key !== 'projectId' && key !== 'ports')) fail('ERR_CONFIG_UNKNOWN', safeDetails('input', 'unknown'));
  let ports; let portsUnknown = false; let portsMissing = false; let portsValid = true; let portValues = REQUIRED_PORTS;
  try {
    ports = input.ports;
    if (ports !== undefined) {
      if (!plain(ports)) portsValid = false;
      else {
        const portKeys = Reflect.ownKeys(ports);
        portsUnknown = portKeys.some((key) => !PORT_KEYS.includes(key));
        const descriptors = PORT_KEYS.map((key) => Object.getOwnPropertyDescriptor(ports, key));
        portsMissing = descriptors.some((descriptor) => !descriptor);
        if (!portsUnknown && !portsMissing) {
          portValues = descriptors.map((descriptor) => descriptor.value);
          portsValid = portValues.every((value, index) => typeof value === 'number' && Number.isSafeInteger(value) && value === REQUIRED_PORTS[PORT_KEYS[index]]);
        }
      }
    }
  } catch { fail('ERR_CONFIG_PORT', safeDetails('ports', 'invalid')); }
  if (portsUnknown) fail('ERR_CONFIG_UNKNOWN', safeDetails('ports', 'unknown'));
  if (portsMissing) fail('ERR_CONFIG_MISSING', safeDetails('ports', 'missing'));
  if (!keys.includes('projectId')) fail('ERR_CONFIG_MISSING', safeDetails('projectId', 'missing'));
  if (!validProjectId(projectId)) fail('ERR_CONFIG_PROJECT_ID', safeDetails('projectId', 'invalid'));
  if (!portsValid) fail('ERR_CONFIG_PORT', safeDetails('ports', 'invalid'));
  const p = ports === undefined ? REQUIRED_PORTS : Object.fromEntries(PORT_KEYS.map((key, index) => [key, portValues[index]]));
  return `project_id = "${projectId}"\n\n[api]\nport = ${p.api}\n\n[db]\nport = ${p.db}\nshadow_port = ${p.dbShadow}\n\n[db.pooler]\nport = ${p.dbPooler}\n\n[studio]\nport = ${p.studio}\n\n[inbucket]\nport = ${p.inbucket}\nsmtp_port = ${p.inbucketSmtp}\npop3_port = ${p.inbucketPop3}\n\n[analytics]\nport = ${p.analytics}\n`;
}

const statements = [
  ['project_id', null], ['[api]', 'api'], ['api.port', 'api'], ['[db]', 'db'], ['db.port', 'db'], ['db.shadow_port', 'dbShadow'],
  ['[db.pooler]', 'dbPooler'], ['db.pooler.port', 'dbPooler'], ['[studio]', 'studio'], ['studio.port', 'studio'],
  ['[inbucket]', 'inbucket'], ['inbucket.port', 'inbucket'], ['inbucket.smtp_port', 'inbucketSmtp'], ['inbucket.pop3_port', 'inbucketPop3'],
  ['[analytics]', 'analytics'], ['analytics.port', 'analytics'],
];
function stripComment(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') quoted = !quoted;
    if (line[i] === '#' && !quoted) return line.slice(0, i);
  }
  return line;
}
export function parseTemporarySupabaseConfig(text) {
  if (typeof text !== 'string' || /\r|[^\x00-\x7F]/.test(text) || !text.endsWith('\n')) fail('ERR_CONFIG_SYNTAX', safeDetails('text', 'invalid'));
  const seen = new Set(); const parsed = {}; const actual = []; let index = 0; let table = ''; let duplicate = false; let unknown = false; let portError = false;
  const lines = text.split('\n'); lines.pop();
  for (const raw of lines) {
    if (/[^\x20-\x7E]/.test(raw)) fail('ERR_CONFIG_SYNTAX', safeDetails('text', 'invalid'));
    const line = stripComment(raw).trimEnd();
    if (!line.trim()) continue;
    const trimmed = line.trimStart();
    let key; let value;
    const header = trimmed.match(/^\[([^\]]*)\]$/);
    if (header) { key = `[${header[1]}]`; value = null; }
    else {
      const assignment = trimmed.match(/^([^=]+?)\s*=\s*(.*)$/);
      if (!assignment) fail('ERR_CONFIG_SYNTAX', safeDetails('text', 'invalid'));
      key = assignment[1].trim(); value = assignment[2].trim();
      if (key.includes('.') || key.includes('"') || key.includes("'")) fail('ERR_CONFIG_SYNTAX', safeDetails('text', 'invalid'));
      if (key === 'project_id') {
        if (!/^"[^"\\]*"$/.test(value)) fail('ERR_CONFIG_SYNTAX', safeDetails('text', 'invalid'));
        value = value.slice(1, -1);
      } else if (!/^\d+$/.test(value) || (value.length > 1 && value.startsWith('0'))) { portError = true; value = '0'; }
    }
    const semantic = key.startsWith('[') || key === 'project_id' ? key : `${table}.${key}`;
    if (!statements.some(([name]) => name === semantic)) { unknown = true; continue; }
    if (seen.has(semantic)) duplicate = true;
    else { actual.push(semantic); seen.add(semantic); index += 1; }
    if (key.startsWith('[')) { table = key.slice(1, -1); parsed[table === 'db.pooler' ? 'dbPooler' : table] = true; }
    else if (key === 'project_id') parsed.projectId = value;
    else { const name = statements.find(([name]) => name === semantic)?.[1]; if (!name) fail('ERR_CONFIG_UNKNOWN', safeDetails('text', 'unknown')); parsed[name] = Number(value); }
  }
  if (duplicate) fail('ERR_CONFIG_DUPLICATE', safeDetails('text', 'duplicate'));
  if (unknown) fail('ERR_CONFIG_UNKNOWN', safeDetails('text', 'unknown'));
  if (index !== statements.length) fail('ERR_CONFIG_MISSING', safeDetails('text', 'missing'));
  if (actual.some((name, position) => statements[position]?.[0] !== name)) fail('ERR_CONFIG_SYNTAX', safeDetails('text', 'invalid'));
  if (!validProjectId(parsed.projectId)) fail('ERR_CONFIG_PROJECT_ID', safeDetails('projectId', 'invalid'));
  const ports = {}; for (const key of PORT_KEYS) { if (portError || !Number.isSafeInteger(parsed[key]) || parsed[key] !== REQUIRED_PORTS[key]) fail('ERR_CONFIG_PORT', safeDetails('ports', 'invalid')); ports[key] = parsed[key]; }
  return { projectId: parsed.projectId, ports };
}

export function createConfigArtifact(input) {
  const text = renderTemporarySupabaseConfig(input); const bytes = new TextEncoder().encode(text); const parsed = parseTemporarySupabaseConfig(text);
  return { schema: 'actravel.recovery-config/v1', projectId: parsed.projectId, ports: { ...parsed.ports }, bytes, sha256: sha256Hex(bytes) };
}

function reflectRead(read) { try { return read(); } catch { fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported')); } }
function canonical(value, ancestors) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported')); return Object.is(value, -0) ? 0 : value; }
  if (typeof value !== 'object') fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported'));
  if (ancestors.has(value)) fail('ERR_CANONICAL_CYCLE', safeDetails('input', 'cycle'));
  ancestors.add(value);
  const isArray = reflectRead(() => Array.isArray(value));
  if (isArray) {
    const length = reflectRead(() => value.length); const keys = reflectRead(() => Reflect.ownKeys(value)); if (keys.length !== length + 1 || !keys.includes('length')) fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported'));
    const out = []; for (let i = 0; i < length; i += 1) { const d = reflectRead(() => Object.getOwnPropertyDescriptor(value, String(i))); if (!d || !('value' in d)) fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported')); out.push(canonical(d.value, ancestors)); } ancestors.delete(value); return out;
  }
  const prototype = reflectRead(() => Object.getPrototypeOf(value)); if (prototype !== Object.prototype && prototype !== null) fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported'));
  const ownKeys = reflectRead(() => Reflect.ownKeys(value)); const stringKeys = reflectRead(() => Object.keys(value)); if (ownKeys.some((key) => typeof key === 'symbol') || ownKeys.filter((key) => typeof key === 'string').length !== stringKeys.length) fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported'));
  const out = Object.create(null); for (const key of stringKeys.sort()) { const d = reflectRead(() => Object.getOwnPropertyDescriptor(value, key)); if (!d || !d.enumerable || !('value' in d)) fail('ERR_CANONICAL_TYPE', safeDetails('input', 'unsupported')); Object.defineProperty(out, key, { enumerable: true, value: canonical(d.value, ancestors), writable: true, configurable: true }); } ancestors.delete(value); return out;
}
export function canonicalJson(value) { return JSON.stringify(canonical(value, new WeakSet())); }
function sha256HexInternal(input) { if (!(typeof input === 'string' || input instanceof Uint8Array)) fail('ERR_HASH_INPUT', safeDetails('input', 'invalid')); return createHash('sha256').update(input).digest('hex'); }
export function sha256Hex(input) { try { return sha256HexInternal(input); } catch { fail('ERR_HASH_INPUT', safeDetails('input', 'invalid')); } }

export function assertRuntimeToken(token) { if (typeof token !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(token)) fail('ERR_TOKEN', safeDetails('value', 'invalid')); return true; }
function optionObject(options, allowed) {
  if (options === undefined) return {};
  let keys; let value;
  try {
    if (!plain(options)) return null;
    keys = Reflect.ownKeys(options);
    if (keys.some((key) => !allowed.includes(key))) return null;
    if (keys.includes('allowCredentials')) {
      const descriptor = Object.getOwnPropertyDescriptor(options, 'allowCredentials');
      if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'boolean') return null;
      value = descriptor.value;
    }
  } catch { fail('ERR_URL', safeDetails('input', 'invalid')); }
  if (value === undefined && keys?.includes('allowCredentials')) fail('ERR_URL', safeDetails('input', 'invalid'));
  return value === undefined ? {} : { allowCredentials: value };
}
function assertLocalUrlInternal(url, options = {}) {
  const allowCredentials = options;
  if (typeof url !== 'string' || url.includes('\\')) fail('ERR_URL', safeDetails('url', 'invalid'));
  const match = url.match(/^(http|https|postgres|postgresql):\/\/([^/?#]*)(?:[/?#].*)?$/); if (!match || url.includes('#')) fail('ERR_URL', safeDetails('url', 'invalid'));
  const authority = match[2]; const at = authority.lastIndexOf('@'); if (at >= 0 && allowCredentials !== true) fail('ERR_URL', safeDetails('url', 'sensitive')); const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  const host = hostPort.startsWith('[') ? hostPort.match(/^(\[[^\]]+\])(?::(.*))?$/) : hostPort.match(/^([^:]*)(?::(.*))?$/); if (!host) fail('ERR_URL', safeDetails('url', 'invalid')); const hostname = host[1]; const port = host[2];
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) || (port !== undefined && (!/^\d+$/.test(port) || Number(port) > 65535))) fail('ERR_URL', safeDetails('url', 'invalid'));
  try { new URL(url); } catch { fail('ERR_URL', safeDetails('url', 'invalid')); } return true;
}
export function assertLocalUrl(url, options = {}) { if (typeof url !== 'string' || url.includes('\\')) fail('ERR_URL', safeDetails('url', 'invalid')); options = optionObject(options, ['allowCredentials']); if (options === null) fail('ERR_URL', safeDetails('input', 'invalid')); const allowCredentials = options.allowCredentials; return assertLocalUrlInternal(url, allowCredentials); }
function denseStrings(value) { if (!Array.isArray(value)) return false; const keys = Reflect.ownKeys(value); if (!keys.includes('length') || keys.length !== value.length + 1) return false; for (let index = 0; index < value.length; index += 1) { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'string') return false; } return true; }
export function assertAllowedFlags(argv) { let length; let descriptors; try { if (!Array.isArray(argv)) fail('ERR_FLAG', safeDetails('argv', 'invalid')); const keys = Reflect.ownKeys(argv); length = argv.length; if (!keys.includes('length') || keys.length !== length + 1) fail('ERR_FLAG', safeDetails('argv', 'invalid')); descriptors = []; for (let index = 0; index < length; index += 1) { const descriptor = Object.getOwnPropertyDescriptor(argv, String(index)); if (!descriptor?.enumerable || !('value' in descriptor)) fail('ERR_FLAG', safeDetails('argv', 'invalid')); descriptors.push(descriptor); } } catch { fail('ERR_FLAG', safeDetails('argv', 'invalid')); } const denied = ['--linked', '--project-ref', '--remote', '--include-linked']; for (let index = 0; index < descriptors.length; index += 1) { const arg = descriptors[index].value; if (typeof arg !== 'string') fail('ERR_FLAG', safeDetails('argv', 'invalid', { index })); if (denied.includes(arg) || denied.some((flag) => arg.startsWith(`${flag}=`))) fail('ERR_FLAG', safeDetails('argv', 'not_allowed', { index })); } return true; }
function safePath(value, absolute) { if (typeof value !== 'string') return false; if (absolute === undefined) absolute = value.startsWith('/'); return !value.includes('\\') && !value.includes('\0') && value === path.posix.normalize(value) && (absolute ? value.startsWith('/') && (value === '/' || !value.endsWith('/')) : !value.startsWith('/') && !value.endsWith('/') && !value.split('/').some((part) => !part || part === '.' || part === '..')); }
function assertContainedPathInternal(repoRealPath, candidateRealPath) { if (!safePath(repoRealPath, true) || !safePath(candidateRealPath, true)) fail('ERR_PATH', safeDetails('path', 'invalid')); if (candidateRealPath === repoRealPath || (repoRealPath === '/' ? !candidateRealPath.startsWith('/') : !candidateRealPath.startsWith(`${repoRealPath}/`))) fail('ERR_PATH', safeDetails('path', 'outside', { path: candidateRealPath, absolute: true })); return true; }
export function assertContainedPath(input) { let repoRealPath; let candidateRealPath; try { if (!plain(input) || !exactKeys(input, ['repoRealPath', 'candidateRealPath'])) fail('ERR_PATH', safeDetails('path', 'invalid')); repoRealPath = input.repoRealPath; candidateRealPath = input.candidateRealPath; } catch { fail('ERR_PATH', safeDetails('path', 'invalid')); } return assertContainedPathInternal(repoRealPath, candidateRealPath); }
function relative(value) { return safePath(value, false); }
export function validateWorktreeEntries(entries, options) {
  let safeEntries; let allowedPaths; let protectedPaths; let optionsValid;
  try {
    safeEntries = snapshotArray(entries, false);
    optionsValid = plain(options);
    if (optionsValid) {
      const optionKeys = Reflect.ownKeys(options);
      optionsValid = exactKeys(options, ['allowedPaths', 'protectedPaths']) && optionKeys.every((key) => { const descriptor = Object.getOwnPropertyDescriptor(options, key); return descriptor?.enumerable && 'value' in descriptor; });
      if (optionsValid) { allowedPaths = snapshotArray(Object.getOwnPropertyDescriptor(options, 'allowedPaths').value, true); protectedPaths = snapshotArray(Object.getOwnPropertyDescriptor(options, 'protectedPaths').value, true); }
    }
  } catch { fail('ERR_WORKTREE', safeDetails('entries', 'invalid')); }
  if (!safeEntries || !optionsValid || !allowedPaths || !protectedPaths || !validPathList(allowedPaths) || !validPathList(protectedPaths)) fail('ERR_WORKTREE', safeDetails('entries', 'invalid'));
  const allowed = new Set(allowedPaths); const protectedSet = new Set(protectedPaths); const seen = new Set();
  for (let index = 0; index < safeEntries.length; index += 1) {
    let entry;
    try { entry = snapshotEntry(safeEntries[index]); } catch { fail('ERR_WORKTREE', safeDetails('entries', 'invalid', { index })); }
    if (!entry || seen.has(entry.path) || !relative(entry.path) || !['M', 'A', 'D', 'R', 'C', 'U', '?', '!'].includes(entry.status) || typeof entry.tracked !== 'boolean') fail('ERR_WORKTREE', safeDetails('entries', 'invalid', { index, path: relative(entry?.path) ? entry.path : undefined }));
    if ((entry.status === '?' || entry.status === '!') ? entry.tracked : !entry.tracked) fail('ERR_WORKTREE', safeDetails('entries', 'invalid', { index, path: entry.path }));
    if (protectedSet.has(entry.path)) fail('ERR_WORKTREE', safeDetails('entries', 'protected', { index, path: entry.path }));
    if (!allowed.has(entry.path)) fail('ERR_WORKTREE', safeDetails('entries', 'not_allowed', { index, path: entry.path }));
    seen.add(entry.path);
  }
  return true;
}
function snapshotEntry(entry) {
  if (!plain(entry) || !exactKeys(entry, ['path', 'status', 'tracked'])) return null;
  const result = Object.create(null);
  for (const key of ['path', 'status', 'tracked']) { const descriptor = Object.getOwnPropertyDescriptor(entry, key); if (!descriptor?.enumerable || !('value' in descriptor)) return null; result[key] = descriptor.value; }
  return result;
}
function snapshotArray(value, strings) {
  if (!Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value); if (!keys.includes('length') || keys.length !== value.length + 1) return null;
  const result = []; for (let index = 0; index < value.length; index += 1) { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor?.enumerable || !('value' in descriptor) || (strings && typeof descriptor.value !== 'string')) return null; result.push(descriptor.value); } return result;
}
function validPathList(value) { return denseStrings(value) && value.every(relative) && new Set(value).size === value.length; }

const SENSITIVE_FLAGS = new Set(['--token', '--password', '--db-url', '--access-token', '--service-role-key']);
const PEM_LABEL = 'PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY|OPENSSH PRIVATE KEY';
const BASE64_LINE = '(?:(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?|(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=))';
const PEM_RE = new RegExp(`(^|\\n)-----BEGIN (?<pemLabel>${PEM_LABEL})-----\\r?\\n(?:(?:${BASE64_LINE})\\r?\\n)+-----END \\k<pemLabel>-----(?=$|\\r?\\n)`, 'g');
const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const KEY_RE = /(?:AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{16,})/g;
const PLACEHOLDER_RE = /^<redacted:[A-Z_]+>$/;
function delimiter(character) { return /[\s\u0000-\u001f\u007f-\u009f]/.test(character); }
function tokenBoundary(text, start, end) { return (start === 0 || !/[A-Za-z0-9_-]/.test(text[start - 1])) && (end === text.length || !/[A-Za-z0-9_-]/.test(text[end])); }
function sharedSpans(text) {
  if (PLACEHOLDER_RE.test(text)) return [];
  const spans = [];
  for (const match of text.matchAll(PEM_RE)) spans.push({ code: 'PEM_PRIVATE_KEY', start: match.index + match[1].length, end: match.index + match[0].length });
  let start = 0;
  while (start < text.length) {
    while (start < text.length && delimiter(text[start])) start += 1;
    if (start >= text.length) break;
    let end = start; while (end < text.length && !delimiter(text[end])) end += 1;
    const candidate = text.slice(start, end);
    if (/^(?:http|https|postgres|postgresql):\/\//.test(candidate)) {
      try { const parsed = new URL(candidate); if (parsed.username || parsed.password) spans.push({ code: 'URL_CREDENTIAL', start, end }); } catch { /* another detector may still match */ }
    }
    start = end;
  }
  for (const [regex, code] of [[JWT_RE, 'JWT_LIKE'], [KEY_RE, 'KNOWN_KEY_PREFIX']]) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) if (tokenBoundary(text, match.index, match.index + match[0].length)) spans.push({ code, start: match.index, end: match.index + match[0].length });
  }
  const priority = { PEM_PRIVATE_KEY: 0, URL_CREDENTIAL: 1, JWT_LIKE: 2, KNOWN_KEY_PREFIX: 3 };
  spans.sort((a, b) => priority[a.code] - priority[b.code] || a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const selected = [];
  for (const span of spans) if (!selected.some((other) => span.start < other.end && other.start < span.end)) selected.push(span);
  return selected.sort((a, b) => a.start - b.start);
}
function sanitizeShared(text, indexOrName, useOffsets = false) {
  const spans = sharedSpans(text); let value = text;
  const redactions = spans.map((span) => ({ code: span.code, indexOrName: useOffsets ? span.start : indexOrName }));
  for (let index = spans.length - 1; index >= 0; index -= 1) { const span = spans[index]; value = `${value.slice(0, span.start)}<redacted:${span.code}>${value.slice(span.end)}`; }
  return { value, redactions };
}
function sanitizerOptions(options, allowed) {
  if (options === undefined) return {};
  try {
    if (!plain(options)) fail('ERR_SANITIZE_INPUT', safeDetails('input', 'invalid'));
    const keys = Reflect.ownKeys(options); if (keys.some((key) => !allowed.includes(key))) fail('ERR_SANITIZE_INPUT', safeDetails('input', 'unknown'));
    const result = {}; for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(options, key); if (!descriptor?.enumerable || !('value' in descriptor)) fail('ERR_SANITIZE_INPUT', safeDetails('input', 'invalid')); result[key] = descriptor.value; } return result;
  } catch { fail('ERR_SANITIZE_INPUT', safeDetails('input', 'invalid')); }
}
function sanitizerScan(value, field) { const result = scanSecrets(value); if (!result.ok) fail('ERR_SANITIZE_INPUT', safeDetails(field, 'sensitive')); }
function snapshotStringArray(value) { try { const result = snapshotArray(value, true); if (!result) fail('ERR_SANITIZE_INPUT', safeDetails('input', 'invalid')); return result; } catch { fail('ERR_SANITIZE_INPUT', safeDetails('input', 'invalid')); } }

export function scanSecrets(input) {
  if (typeof input === 'string') return { ok: sharedSpans(input).length === 0, findings: sharedSpans(input).map(({ code, start }) => ({ code, index: start })) };
  const values = snapshotStringArray(input); const findings = [];
  values.forEach((value, index) => sharedSpans(value).forEach(({ code }) => findings.push({ code, index })));
  return { ok: findings.length === 0, findings };
}
export function sanitizeArgv(argv, options = {}) {
  sanitizerOptions(options, []); const source = snapshotStringArray(argv); const value = []; const redactions = [];
  for (let index = 0; index < source.length; index += 1) {
    const arg = source[index]; const equals = arg.indexOf('='); const flag = equals < 0 ? arg : arg.slice(0, equals);
    if (SENSITIVE_FLAGS.has(arg) || (SENSITIVE_FLAGS.has(flag) && equals >= 0)) {
      if (equals >= 0) { value.push(`${flag}=<redacted:FLAG_VALUE>`); redactions.push({ code: 'FLAG_VALUE', indexOrName: index }); }
      else { if (index + 1 >= source.length) fail('ERR_SANITIZE_INPUT', safeDetails('argv', 'invalid', { index })); value.push(arg); index += 1; value.push('<redacted:FLAG_VALUE>'); redactions.push({ code: 'FLAG_VALUE', indexOrName: index }); }
    } else { const sanitized = sanitizeShared(arg, index); value.push(sanitized.value); redactions.push(...sanitized.redactions); }
  }
  sanitizerScan(value, 'argv'); return { value, redactions };
}
function sensitiveEnvName(name) { return /^(?:DATABASE_URL|DB_URL|POSTGRES_URL|POSTGRESQL_URL)$/i.test(name) || /(^|[_-])(PASSWORD|TOKEN|SECRET|KEY)([_-]|$)/i.test(name) || /(^|[_-])(DATABASE|DB|POSTGRES|POSTGRESQL)[_-]?URL([_-]|$)/i.test(name); }
export function sanitizeEnv(env, options = {}) {
  const parsed = sanitizerOptions(options, ['allowNames']); let allow = [];
  if (parsed.allowNames !== undefined) { allow = snapshotStringArray(parsed.allowNames); if (new Set(allow).size !== allow.length) fail('ERR_SANITIZE_INPUT', safeDetails('input', 'duplicate')); }
  let keys; try { if (!plain(env)) fail('ERR_SANITIZE_INPUT', safeDetails('env', 'invalid')); keys = Reflect.ownKeys(env); if (keys.some((key) => typeof key !== 'string')) fail('ERR_SANITIZE_INPUT', safeDetails('env', 'invalid')); } catch { fail('ERR_SANITIZE_INPUT', safeDetails('env', 'invalid')); }
  const value = Object.create(null); const redactions = [];
  try { for (const name of keys) { const descriptor = Object.getOwnPropertyDescriptor(env, name); if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'string') fail('ERR_SANITIZE_INPUT', safeDetails('env', 'invalid')); if (sensitiveEnvName(name) && !allow.includes(name)) { value[name] = '<redacted:ENV_VALUE>'; redactions.push({ code: 'ENV_VALUE', indexOrName: name }); } else { const sanitized = sanitizeShared(descriptor.value, name); value[name] = sanitized.value; redactions.push(...sanitized.redactions); } } } catch { fail('ERR_SANITIZE_INPUT', safeDetails('env', 'invalid')); }
  sanitizerScan(Object.keys(value).sort().map((name) => value[name]), 'env'); return { value, redactions };
}
export function sanitizeText(text, options = {}) {
  if (typeof text !== 'string') fail('ERR_SANITIZE_INPUT', safeDetails('text', 'invalid')); const parsed = sanitizerOptions(options, ['maxBytes']); const maxBytes = parsed.maxBytes === undefined ? 16384 : parsed.maxBytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) fail('ERR_SANITIZE_LIMIT', safeDetails('value', 'out_of_range')); const sanitized = sanitizeShared(text, 0, true); sanitizerScan(sanitized.value, 'text'); const fullSha256 = sha256Hex(sanitized.value); const bytes = new TextEncoder().encode(sanitized.value); let value = ''; let retainedBytes = 0;
  for (const character of sanitized.value) { const size = new TextEncoder().encode(character).length; if (retainedBytes + size > maxBytes) break; value += character; retainedBytes += size; }
  return { value, fullSha256, truncated: retainedBytes < bytes.length, retainedBytes, redactions: sanitized.redactions };
}
