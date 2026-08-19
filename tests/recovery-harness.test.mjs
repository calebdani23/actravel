import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '../scripts/recovery-harness-lib.mjs';
import {
  REQUIRED_PORTS,
  renderTemporarySupabaseConfig,
  parseTemporarySupabaseConfig,
  createConfigArtifact,
  canonicalJson,
  sha256Hex,
  sanitizeArgv,
  sanitizeEnv,
  sanitizeText,
  scanSecrets,
  assertRuntimeToken,
  assertLocalUrl,
  assertAllowedFlags,
  assertContainedPath,
  validateWorktreeEntries,
} from '../scripts/recovery-harness-lib.mjs';

const expectedExports = [
  'REQUIRED_PORTS', 'renderTemporarySupabaseConfig', 'parseTemporarySupabaseConfig',
  'createConfigArtifact', 'canonicalJson', 'sha256Hex', 'assertRuntimeToken',
  'sanitizeArgv', 'sanitizeEnv', 'sanitizeText', 'scanSecrets',
  'assertLocalUrl', 'assertAllowedFlags', 'assertContainedPath',
  'validateWorktreeEntries',
];

function code(error, expected) {
  assert.equal(error.name, 'RecoveryHarnessError');
  assert.equal(error.code, expected);
  assert.equal(error.message, expected);
  assert.ok(Object.getPrototypeOf(error.details) === Object.prototype);
  assert.ok(Object.keys(error.details).every((key) =>
    ['field', 'reason', 'path', 'index', 'findingCode'].includes(key)));
}

function throws(expected, fn) {
  assert.throws(fn, (error) => { code(error, expected); return true; });
}

const config = `project_id = "demo-project"\n\n[api]\nport = 54321\n\n[db]\nport = 54322\nshadow_port = 54320\n\n[db.pooler]\nport = 54329\n\n[studio]\nport = 54323\n\n[inbucket]\nport = 54324\nsmtp_port = 54325\npop3_port = 54326\n\n[analytics]\nport = 54327\n`;

test('Code A exposes the coherent core subset and frozen ports', () => {
  assert.deepEqual(Object.keys(REQUIRED_PORTS), [
    'api', 'db', 'dbShadow', 'dbPooler', 'studio', 'inbucket',
    'inbucketSmtp', 'inbucketPop3', 'analytics',
  ]);
  assert.deepEqual(REQUIRED_PORTS, {
    api: 54321, db: 54322, dbShadow: 54320, dbPooler: 54329, studio: 54323,
    inbucket: 54324, inbucketSmtp: 54325, inbucketPop3: 54326, analytics: 54327,
  });
  assert.equal(Object.isFrozen(REQUIRED_PORTS), true);
  assert.deepEqual(Object.keys(module).sort(), expectedExports.slice().sort());
  assert.deepEqual(expectedExports.sort(), [
   'REQUIRED_PORTS', 'assertAllowedFlags', 'assertContainedPath', 'assertLocalUrl',
   'assertRuntimeToken', 'canonicalJson', 'createConfigArtifact',
   'parseTemporarySupabaseConfig', 'renderTemporarySupabaseConfig', 'sanitizeArgv',
   'sanitizeEnv', 'sanitizeText', 'scanSecrets', 'sha256Hex',
    'validateWorktreeEntries',
  ].sort());
});

test('renders and parses the exact temporary config without mutation', () => {
  const ports = { ...REQUIRED_PORTS };
  const before = JSON.stringify(ports);
  assert.equal(renderTemporarySupabaseConfig({ projectId: 'demo-project' }), config);
  assert.equal(renderTemporarySupabaseConfig({ projectId: 'demo-project', ports }), config);
  assert.equal(JSON.stringify(ports), before);
  assert.deepEqual(parseTemporarySupabaseConfig(config), {
    projectId: 'demo-project', ports: REQUIRED_PORTS,
  });
  const decorated = config.replace('project_id', '  project_id  ')
    .replace('\n\n[db]', '\n # comment\n\n  [db] # table\n')
    .replace('port = 54321', 'port  = 54321 # api');
  assert.deepEqual(parseTemporarySupabaseConfig(decorated), {
    projectId: 'demo-project', ports: REQUIRED_PORTS,
  });
});

test('rejects config shape, grammar, duplicate, order, and value defects safely', () => {
  throws('ERR_CONFIG_MISSING', () => renderTemporarySupabaseConfig({}));
  throws('ERR_CONFIG_PROJECT_ID', () => renderTemporarySupabaseConfig({ projectId: 'Demo' }));
  throws('ERR_CONFIG_UNKNOWN', () => renderTemporarySupabaseConfig({ projectId: 'x', extra: true }));
  throws('ERR_CONFIG_PORT', () => renderTemporarySupabaseConfig({ projectId: 'x', ports: { ...REQUIRED_PORTS, api: 1 } }));
  throws('ERR_CONFIG_SYNTAX', () => parseTemporarySupabaseConfig(config.replaceAll('\n', '\r\n')));
  throws('ERR_CONFIG_SYNTAX', () => parseTemporarySupabaseConfig(config.slice(0, -1)));
  throws('ERR_CONFIG_DUPLICATE', () => parseTemporarySupabaseConfig(config.replace('port = 54321', 'port = 54321\nport = 54321')));
  throws('ERR_CONFIG_UNKNOWN', () => parseTemporarySupabaseConfig(config.replace('[api]', '[unknown]')));
  throws('ERR_CONFIG_MISSING', () => parseTemporarySupabaseConfig(config.replace('shadow_port = 54320\n', '')));
  throws('ERR_CONFIG_PORT', () => parseTemporarySupabaseConfig(config.replace('port = 54321', 'port = 054321')));
  throws('ERR_CONFIG_SYNTAX', () => parseTemporarySupabaseConfig(config.replace('project_id = "demo-project"', 'project_id = "demo\\"project"')));
  throws('ERR_CONFIG_DUPLICATE', () => parseTemporarySupabaseConfig(config.replace('[api]', '[db]')));
});

test('creates bound fresh config artifacts', () => {
  const artifact = createConfigArtifact({ projectId: 'demo-project' });
  assert.deepEqual(Object.keys(artifact), ['schema', 'projectId', 'ports', 'bytes', 'sha256']);
  assert.equal(artifact.schema, 'actravel.recovery-config/v1');
  assert.equal(artifact.projectId, 'demo-project');
  assert.notEqual(artifact.ports, REQUIRED_PORTS);
  assert.ok(artifact.bytes instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(artifact.bytes), config);
  assert.equal(artifact.sha256, sha256Hex(artifact.bytes));
  assert.deepEqual(parseTemporarySupabaseConfig(new TextDecoder().decode(artifact.bytes)), {
    projectId: artifact.projectId, ports: artifact.ports,
  });
});

test('canonicalizes the closed JSON domain and rejects unsafe shapes', () => {
  const repeated = { value: 1 };
  assert.equal(canonicalJson({ z: -0, a: [null, repeated, repeated], 'é': '✓' }), '{"a":[null,{"value":1},{"value":1}],"z":0,"é":"✓"}');
  assert.equal(canonicalJson(Object.assign(Object.create(null), { b: true, a: 'x' })), '{"a":"x","b":true}');
  assert.equal(canonicalJson(['line\n', '\u0000']), '["line\\n","\\u0000"]');
  for (const value of [1.2, Number.NaN, Infinity, undefined, 1n, () => {}, Symbol('x'), Object.create(Date.prototype)]) {
    throws('ERR_CANONICAL_TYPE', () => canonicalJson(value));
  }
  const cycle = {}; cycle.self = cycle;
  throws('ERR_CANONICAL_CYCLE', () => canonicalJson(cycle));
  const sparse = []; sparse[1] = 'x';
  throws('ERR_CANONICAL_TYPE', () => canonicalJson(sparse));
  const extra = []; extra.foo = 1;
  throws('ERR_CANONICAL_TYPE', () => canonicalJson(extra));
  const accessor = {}; Object.defineProperty(accessor, 'x', { enumerable: true, get() { return 1; } });
  throws('ERR_CANONICAL_TYPE', () => canonicalJson(accessor));
  assert.equal(canonicalJson({ x: repeated, y: repeated }), '{"x":{"value":1},"y":{"value":1}}');
});

test('hashes exact strings and byte ranges without mutation', () => {
  const bytes = new Uint8Array([0, 1, 2, 3]);
  const view = bytes.subarray(1, 3);
  const copy = Uint8Array.from(view);
  assert.equal(sha256Hex(String.fromCharCode(1, 2)), sha256Hex(view));
  assert.equal(sha256Hex(Uint8Array.from(copy)), sha256Hex(view));
  assert.deepEqual(bytes, new Uint8Array([0, 1, 2, 3]));
  for (const value of [null, 1, {}, [], new Uint8Array(0).buffer]) throws('ERR_HASH_INPUT', () => sha256Hex(value));
});

test('guards runtime tokens, literal local URLs, and exact denied flags', () => {
  assert.equal(assertRuntimeToken(`sha256:${'a'.repeat(64)}`), true);
  throws('ERR_TOKEN', () => assertRuntimeToken(`sha256:${'A'.repeat(64)}`));
  throws('ERR_TOKEN', () => assertRuntimeToken('sha256:short'));
  for (const scheme of ['http', 'https', 'postgres', 'postgresql']) {
    assert.equal(assertLocalUrl(`${scheme}://localhost:54321/path?q=1`), true);
    assert.equal(assertLocalUrl(`${scheme}://127.0.0.1`), true);
  assert.equal(assertLocalUrl(`${scheme}://[::1]`), true);
  }
  assert.equal(assertLocalUrl('http://user:pass@localhost/db', { allowCredentials: true }), true);
  for (const url of ['http://localhost#x', 'http://localhost.evil', 'http://127.1', 'http://2130706433', 'http://localhost:0x10', 'http://remote']) {
    throws('ERR_URL', () => assertLocalUrl(url));
  }
  throws('ERR_URL', () => assertLocalUrl('http://user@localhost'));
  assert.equal(assertAllowedFlags(['--remote-cache', '--ok']), true);
  for (const flag of ['--linked', '--project-ref', '--remote', '--include-linked', '--remote=x']) {
    throws('ERR_FLAG', () => assertAllowedFlags([flag]));
  }
});

test('guards strict canonical containment and exact worktree policy', () => {
  assert.equal(assertContainedPath({ repoRealPath: '/repo', candidateRealPath: '/repo/src/file' }), true);
  for (const paths of [
    { repoRealPath: '/repo', candidateRealPath: '/repo' },
    { repoRealPath: '/repo', candidateRealPath: '/repository/file' },
    { repoRealPath: '/repo', candidateRealPath: '/repo/../outside' },
    { repoRealPath: 'repo', candidateRealPath: '/repo/file' },
    { repoRealPath: '/repo/', candidateRealPath: '/repo/file' },
    { repoRealPath: '/repo', candidateRealPath: '/repo/child/' },
  ]) throws('ERR_PATH', () => assertContainedPath(paths));
  assert.equal(assertContainedPath({ repoRealPath: '/', candidateRealPath: '/child' }), true);
  const entries = [
    { path: 'src/a.js', status: 'M', tracked: true },
    { path: 'new.txt', status: '?', tracked: false },
    { path: 'gone.txt', status: '!', tracked: false },
  ];
  assert.equal(validateWorktreeEntries(entries, { allowedPaths: ['src/a.js', 'new.txt', 'gone.txt'], protectedPaths: [] }), true);
  throws('ERR_WORKTREE', () => validateWorktreeEntries(entries, { allowedPaths: ['src/a.js', 'new.txt', 'gone.txt'], protectedPaths: ['new.txt'] }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'src/a.js', status: '?', tracked: true }], { allowedPaths: ['src/a.js'], protectedPaths: [] }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: '../secret', status: 'M', tracked: true }], { allowedPaths: ['../secret'], protectedPaths: [] }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'src/a.js', status: 'M', tracked: true }], { allowedPaths: ['src'], protectedPaths: [] }));
});

test('fresh Code A validator defects are closed and diagnostic-safe', () => {
  const protoKey = Object.create(null);
  Object.defineProperty(protoKey, '__proto__', { enumerable: true, value: 'kept' });
  assert.equal(canonicalJson(protoKey), '{"__proto__":"kept"}');

  throws('ERR_PATH', () => assertContainedPath({ repoRealPath: 7, candidateRealPath: '/repo/x' }));
  const sparseFlags = []; sparseFlags[1] = '--ok';
  throws('ERR_FLAG', () => assertAllowedFlags(sparseFlags));
  const extraFlags = ['--ok']; extraFlags.extra = true;
  throws('ERR_FLAG', () => assertAllowedFlags(extraFlags));
  const compensatingFlags = []; compensatingFlags.length = 2; compensatingFlags[1] = '--ok'; compensatingFlags.extra = true;
  throws('ERR_FLAG', () => assertAllowedFlags(compensatingFlags));
  assert.throws(() => assertAllowedFlags(['--remote', 7]), (error) => {
    code(error, 'ERR_FLAG');
    assert.equal(error.details.reason, 'not_allowed');
    assert.equal(error.details.index, 0);
    return true;
  });
  const sparseEntries = []; sparseEntries[1] = { path: 'x', status: 'M', tracked: true };
  throws('ERR_WORKTREE', () => validateWorktreeEntries(sparseEntries, { allowedPaths: ['x'], protectedPaths: [] }));
  const extraEntries = [{ path: 'x', status: 'M', tracked: true }]; extraEntries.extra = true;
  throws('ERR_WORKTREE', () => validateWorktreeEntries(extraEntries, { allowedPaths: ['x'], protectedPaths: [] }));
  const compensatingEntries = []; compensatingEntries.length = 2; compensatingEntries[1] = { path: 'x', status: 'M', tracked: true }; compensatingEntries.extra = true;
  throws('ERR_WORKTREE', () => validateWorktreeEntries(compensatingEntries, { allowedPaths: ['x'], protectedPaths: [] }));
  const hidden = {};
  Object.defineProperties(hidden, {
    path: { enumerable: true, value: 'x' }, status: { enumerable: true, value: 'M' },
    tracked: { enumerable: false, value: true },
  });
  throws('ERR_WORKTREE', () => validateWorktreeEntries([hidden], { allowedPaths: ['x'], protectedPaths: [] }));
  throws('ERR_URL', () => assertLocalUrl('http://evil\\@localhost', { allowCredentials: true }));

  const unknownAndMissing = { projectId: 'Bad', ports: { ...REQUIRED_PORTS, extra: 1 } };
  delete unknownAndMissing.ports.analytics;
  throws('ERR_CONFIG_UNKNOWN', () => renderTemporarySupabaseConfig(unknownAndMissing));
  throws('ERR_CONFIG_UNKNOWN', () => renderTemporarySupabaseConfig({ unknown: true }));
  const missingPort = { ...REQUIRED_PORTS }; delete missingPort.analytics;
  throws('ERR_CONFIG_MISSING', () => renderTemporarySupabaseConfig({ projectId: 'Bad', ports: missingPort }));
  throws('ERR_CONFIG_PROJECT_ID', () => renderTemporarySupabaseConfig({ projectId: 'Bad', ports: { ...REQUIRED_PORTS, analytics: 1 } }));
  throws('ERR_CONFIG_PORT', () => renderTemporarySupabaseConfig({ projectId: 'x', ports: { ...REQUIRED_PORTS, analytics: 1 } }));
  throws('ERR_CONFIG_SYNTAX', () => parseTemporarySupabaseConfig(config.replace('port = 54321', 'api.port = 54321')));
  throws('ERR_CONFIG_SYNTAX', () => parseTemporarySupabaseConfig(config.replace('port = 54321', '"port" = 54321')));
  const duplicateThenSyntax = config.replace('[api]', '[api]\nport = 54321').replace('port = 54327', 'port ???');
  throws('ERR_CONFIG_SYNTAX', () => parseTemporarySupabaseConfig(duplicateThenSyntax));

  assert.throws(() => assertContainedPath({ repoRealPath: '/repo', candidateRealPath: '/other/x' }), (error) => {
    code(error, 'ERR_PATH');
    assert.equal(error.details.field, 'path');
    assert.equal(error.details.reason, 'outside');
    assert.equal(error.details.path, '/other/x');
    return true;
  });
  assert.throws(() => assertAllowedFlags(['--remote']), (error) => {
    code(error, 'ERR_FLAG');
    assert.equal(error.details.field, 'argv');
    assert.equal(error.details.reason, 'not_allowed');
    assert.equal(error.details.index, 0);
    return true;
  });

  const throwing = () => { throw new Error('secret-native-detail'); };
  const configProxy = new Proxy({}, { getPrototypeOf: throwing });
  assert.throws(() => renderTemporarySupabaseConfig(configProxy), (error) => {
    code(error, 'ERR_CONFIG_SYNTAX');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const ports = { ...REQUIRED_PORTS };
  Object.defineProperty(ports, 'api', { enumerable: true, get: throwing });
  assert.throws(() => renderTemporarySupabaseConfig({ projectId: 'x', ports }), (error) => {
    code(error, 'ERR_CONFIG_PORT');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const optionsProxy = new Proxy({}, { getPrototypeOf: throwing });
  assert.throws(() => assertLocalUrl('http://localhost', optionsProxy), (error) => {
    code(error, 'ERR_URL');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const entriesProxy = new Proxy([], { ownKeys: throwing });
  assert.throws(() => validateWorktreeEntries(entriesProxy, { allowedPaths: [], protectedPaths: [] }), (error) => {
    code(error, 'ERR_WORKTREE');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const entryProxy = new Proxy({ path: 'x', status: 'M', tracked: true }, { ownKeys: throwing });
  assert.throws(() => validateWorktreeEntries([entryProxy], { allowedPaths: ['x'], protectedPaths: [] }), (error) => {
    code(error, 'ERR_WORKTREE');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const hashProxy = new Proxy(new Uint8Array([1]), { getPrototypeOf: throwing });
  assert.throws(() => sha256Hex(hashProxy), (error) => {
    code(error, 'ERR_HASH_INPUT');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const urlOptionsAccessor = {};
  Object.defineProperty(urlOptionsAccessor, 'allowCredentials', { get: throwing });
  assert.throws(() => assertLocalUrl('http://localhost', urlOptionsAccessor), (error) => {
    code(error, 'ERR_URL');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const nonthrowingAccessor = {};
  Object.defineProperty(nonthrowingAccessor, 'allowCredentials', { enumerable: true, get: () => true });
  throws('ERR_URL', () => assertLocalUrl('http://localhost', nonthrowingAccessor));
  const hiddenOption = {};
  Object.defineProperty(hiddenOption, 'allowCredentials', { enumerable: false, value: true });
  throws('ERR_URL', () => assertLocalUrl('http://localhost', hiddenOption));
  throws('ERR_URL', () => assertLocalUrl('http://localhost', { allowCredentials: true, extra: false }));
  const worktreeAccessorOptions = { allowedPaths: ['x'], protectedPaths: [] };
  Object.defineProperty(worktreeAccessorOptions, 'allowedPaths', { enumerable: true, get: () => ['x'] });
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], worktreeAccessorOptions));
  const worktreeHiddenOptions = { protectedPaths: [] };
  Object.defineProperty(worktreeHiddenOptions, 'allowedPaths', { enumerable: false, value: ['x'] });
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], worktreeHiddenOptions));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], { allowedPaths: ['x'], protectedPaths: [], extra: true }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], { allowedPaths: ['../x'], protectedPaths: [] }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], { allowedPaths: ['x', 'x'], protectedPaths: [] }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], { allowedPaths: ['x'], protectedPaths: ['../x'] }));
  throws('ERR_WORKTREE', () => validateWorktreeEntries([{ path: 'x', status: 'M', tracked: true }], { allowedPaths: ['x'], protectedPaths: ['x', 'x'] }));
  const protectedFirstEntry = { path: 'protected.txt', status: 'M', tracked: true };
  const malformedLaterEntry = new Proxy({ path: 'later.txt', status: 'M', tracked: true }, { ownKeys: () => { throw new Error('later-entry-detail'); } });
  assert.throws(() => validateWorktreeEntries([protectedFirstEntry, malformedLaterEntry], { allowedPaths: ['protected.txt', 'later.txt'], protectedPaths: ['protected.txt'] }), (error) => {
    code(error, 'ERR_WORKTREE');
    assert.equal(error.details.reason, 'protected');
    assert.equal(error.details.index, 0);
    return true;
  });
  const invalidFirstEntry = { path: 'not-allowed.txt', status: 'M', tracked: true };
  assert.throws(() => validateWorktreeEntries([invalidFirstEntry, protectedFirstEntry], { allowedPaths: ['protected.txt'], protectedPaths: ['protected.txt'] }), (error) => {
    code(error, 'ERR_WORKTREE');
    assert.equal(error.details.reason, 'not_allowed');
    assert.equal(error.details.index, 0);
    return true;
  });
  const urlProxy = new Proxy({}, { getPrototypeOf: throwing });
  assert.throws(() => assertLocalUrl(urlProxy), (error) => {
    code(error, 'ERR_URL');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const flagProxy = new Proxy([], { ownKeys: throwing });
  assert.throws(() => assertAllowedFlags(flagProxy), (error) => {
    code(error, 'ERR_FLAG');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });
  const pathProxy = { get repoRealPath() { throw new Error('secret-native-detail'); }, candidateRealPath: '/repo/x' };
  assert.throws(() => assertContainedPath(pathProxy), (error) => {
    code(error, 'ERR_PATH');
    assert.equal(JSON.stringify(error).includes('secret-native-detail'), false);
    return true;
  });

  let injected;
  try { assertRuntimeToken('not-a-token'); } catch (error) { injected = error; }
  injected.code = 'ERR_URL'; injected.details.reason = 'sensitive';
  const throwsInjected = () => { throw injected; };
  const injectedConfig = new Proxy({}, { getPrototypeOf: throwsInjected });
  assert.throws(() => renderTemporarySupabaseConfig(injectedConfig), (error) => { code(error, 'ERR_CONFIG_SYNTAX'); assert.notEqual(error, injected); return true; });
  const injectedPorts = new Proxy({ ...REQUIRED_PORTS }, { ownKeys: throwsInjected });
  assert.throws(() => renderTemporarySupabaseConfig({ projectId: 'x', ports: injectedPorts }), (error) => { code(error, 'ERR_CONFIG_PORT'); assert.notEqual(error, injected); return true; });
  const injectedHash = new Proxy(new Uint8Array([1]), { getPrototypeOf: throwsInjected });
  assert.throws(() => sha256Hex(injectedHash), (error) => { code(error, 'ERR_HASH_INPUT'); assert.notEqual(error, injected); return true; });
  const injectedOptions = new Proxy({}, { getPrototypeOf: throwsInjected });
  assert.throws(() => assertLocalUrl('http://localhost', injectedOptions), (error) => { code(error, 'ERR_URL'); assert.notEqual(error, injected); return true; });
  const injectedFlags = new Proxy([], { ownKeys: throwsInjected });
  assert.throws(() => assertAllowedFlags(injectedFlags), (error) => { code(error, 'ERR_FLAG'); assert.notEqual(error, injected); return true; });
  const injectedPath = { get repoRealPath() { throw injected; }, candidateRealPath: '/repo/x' };
  assert.throws(() => assertContainedPath(injectedPath), (error) => { code(error, 'ERR_PATH'); assert.notEqual(error, injected); return true; });
  const injectedEntries = new Proxy([], { ownKeys: throwsInjected });
  assert.throws(() => validateWorktreeEntries(injectedEntries, { allowedPaths: [], protectedPaths: [] }), (error) => { code(error, 'ERR_WORKTREE'); assert.notEqual(error, injected); return true; });
  const injectedEntry = new Proxy({ path: 'x', status: 'M', tracked: true }, { ownKeys: throwsInjected });
  assert.throws(() => validateWorktreeEntries([injectedEntry], { allowedPaths: ['x'], protectedPaths: [] }), (error) => { code(error, 'ERR_WORKTREE'); assert.notEqual(error, injected); return true; });
  const canonicalArray = new Proxy([], { get(target, property, receiver) { if (property === 'length') throw injected; return Reflect.get(target, property, receiver); } });
  assert.throws(() => canonicalJson(canonicalArray), (error) => { code(error, 'ERR_CANONICAL_TYPE'); assert.notEqual(error, injected); return true; });
  const revokedArrayTarget = [];
  const revokedArray = Proxy.revocable(revokedArrayTarget, {});
  revokedArray.revoke();
  throws('ERR_CANONICAL_TYPE', () => canonicalJson(revokedArray.proxy));
  const unknownGetterPorts = new Proxy({ ...REQUIRED_PORTS, extra: 1 }, { get(target, property, receiver) { if (property === 'api') throw injected; return Reflect.get(target, property, receiver); } });
  throws('ERR_CONFIG_UNKNOWN', () => renderTemporarySupabaseConfig({ projectId: 'Bad', ports: unknownGetterPorts }));
  const missingGetterTarget = { ...REQUIRED_PORTS }; delete missingGetterTarget.analytics;
  const missingGetterPorts = new Proxy(missingGetterTarget, { get(target, property, receiver) { if (property === 'api') throw injected; return Reflect.get(target, property, receiver); } });
  throws('ERR_CONFIG_MISSING', () => renderTemporarySupabaseConfig({ projectId: 'Bad', ports: missingGetterPorts }));
});

test('Code A tests contain no clock-dependent calls', () => {
  const deterministicSource = 'UTC literals only: 2026-01-01T00:00:00.000Z';
  const forbiddenConstructors = new RegExp(['new', ' Date', '\\(\\)'].join(''));
  const forbiddenClockReads = new RegExp(['Date', '\\.now', '\\(\\)'].join(''));
  assert.doesNotMatch(deterministicSource, forbiddenConstructors);
  assert.doesNotMatch(deterministicSource, forbiddenClockReads);
});

test('Code B sanitizes contextual values before shared detection', () => {
  const argv = ['--token', 'postgres://user:pass@localhost/db', '--db-url=postgres://u:p@x',
    'https://u:p@example.test/a', 'ordinary'];
  const argvCopy = JSON.stringify(argv);
  const safeArgv = sanitizeArgv(argv);
  assert.deepEqual(safeArgv.value, ['--token', '<redacted:FLAG_VALUE>', '--db-url=<redacted:FLAG_VALUE>',
    '<redacted:URL_CREDENTIAL>', 'ordinary']);
  assert.deepEqual(safeArgv.redactions, [
    { code: 'FLAG_VALUE', indexOrName: 1 }, { code: 'FLAG_VALUE', indexOrName: 2 },
    { code: 'URL_CREDENTIAL', indexOrName: 3 },
  ]);
  assert.equal(JSON.stringify(argv), argvCopy);
  const env = { DATABASE_URL: 'postgres://u:p@localhost/db', Keep: 'ghp_12345678901234567890' };
  const safeEnv = sanitizeEnv(env);
  assert.equal(safeEnv.value.DATABASE_URL, '<redacted:ENV_VALUE>');
  assert.equal(safeEnv.value.Keep, '<redacted:KNOWN_KEY_PREFIX>');
  assert.deepEqual(safeEnv.redactions, [
    { code: 'ENV_VALUE', indexOrName: 'DATABASE_URL' },
    { code: 'KNOWN_KEY_PREFIX', indexOrName: 'Keep' },
  ]);
  assert.equal(sanitizeEnv({ DATABASE_URL: 'postgres://u:p@localhost/db' }, { allowNames: ['DATABASE_URL'] }).value.DATABASE_URL,
    '<redacted:URL_CREDENTIAL>');
});

test('Code B detects exact secret grammars and safe findings', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nQUJDRA==\n-----END PRIVATE KEY-----';
  const text = `${pem}\neyJabcde.fghij.klmno AKIA1234567890ABCDEF`;
  const result = scanSecrets(text);
  assert.deepEqual(result.findings.map(({ code, index }) => ({ code, index })), [
    { code: 'PEM_PRIVATE_KEY', index: 0 }, { code: 'JWT_LIKE', index: pem.length + 1 },
    { code: 'KNOWN_KEY_PREFIX', index: pem.length + 1 + 21 },
  ]);
  assert.equal(JSON.stringify(result).includes('QUJDRA'), false);
  assert.equal(scanSecrets(['ordinary', 'sha256:' + 'a'.repeat(64), '<redacted:URL_CREDENTIAL>']).ok, true);
  assert.equal(scanSecrets('https://u:p@example.test/path?key=AKIA1234567890ABCDEF').findings.length, 1);
  assert.equal(scanSecrets('xxeyJabcde.fghij.klmno').ok, true);
});

test('Code B bounds UTF-8 text after full sanitization', () => {
  const full = sanitizeText('😀😀AKIA1234567890ABCDEF', { maxBytes: 5 });
  assert.equal(full.value, '😀');
  assert.equal(full.retainedBytes, 4);
  assert.equal(full.truncated, true);
  assert.equal(full.fullSha256, sha256Hex('😀😀<redacted:KNOWN_KEY_PREFIX>'));
  assert.deepEqual(full.redactions, [{ code: 'KNOWN_KEY_PREFIX', indexOrName: 4 }]);
  throws('ERR_SANITIZE_LIMIT', () => sanitizeText('x', { maxBytes: -1 }));
  throws('ERR_SANITIZE_INPUT', () => sanitizeArgv(['--token']));
  throws('ERR_SANITIZE_INPUT', () => scanSecrets([, 'x']));
});

test('Code B covers every sensitive argv form and rejects unsafe shapes', () => {
  const flags = ['--token', '--password', '--db-url', '--access-token', '--service-role-key'];
  for (const flag of flags) {
    assert.deepEqual(sanitizeArgv([flag, 'https://u:p@example.test/x']).value, [flag, '<redacted:FLAG_VALUE>']);
    assert.deepEqual(sanitizeArgv([`${flag}=https://u:p@example.test/x`]).value, [`${flag}=<redacted:FLAG_VALUE>`]);
  }
  assert.deepEqual(sanitizeArgv(['--tokenized', 'https://u:p@example.test/x']).value, ['--tokenized', '<redacted:URL_CREDENTIAL>']);
  assert.deepEqual(sanitizeArgv(['<redacted:FLAG_VALUE>', '<redacted:ENV_VALUE>']).redactions, []);
  const source = ['--token', 'value']; assert.deepEqual(sanitizeArgv(source).value, ['--token', '<redacted:FLAG_VALUE>']); assert.deepEqual(source, ['--token', 'value']);
  for (const value of [null, {}, [, 'x'], Object.assign(['x'], { extra: true }), ['x', 1]]) throws('ERR_SANITIZE_INPUT', () => sanitizeArgv(value));
  const trap = new Error('secret-native-error'); const proxy = new Proxy([], { ownKeys() { throw trap; } });
  assert.throws(() => sanitizeArgv(proxy), (error) => { code(error, 'ERR_SANITIZE_INPUT'); assert.notEqual(error, trap); assert.equal(JSON.stringify(error).includes('secret-native-error'), false); return true; });
  let injectedError;
  try { assertRuntimeToken('bad'); } catch (error) { injectedError = error; }
  injectedError.code = 'ERR_SANITIZE_INPUT'; injectedError.message = 'caller-secret';
  const injectedProxy = new Proxy([], { ownKeys() { throw injectedError; } });
  assert.throws(() => sanitizeArgv(injectedProxy), (error) => { code(error, 'ERR_SANITIZE_INPUT'); assert.notEqual(error, injectedError); return true; });
});

test('Code B covers env sensitivity, allowNames, and reflective failures', () => {
  const names = ['DATABASE_URL', 'db_url', 'POSTGRES_URL', 'POSTGRESQL_URL', 'PASSWORD', 'auth-token', 'api_secret', 'service-key'];
  const env = Object.fromEntries(names.map((name) => [name, 'https://u:p@example.test/x']));
  const safe = sanitizeEnv(env);
  for (const name of names) assert.equal(safe.value[name], '<redacted:ENV_VALUE>');
  const allowed = sanitizeEnv({ 'api_secret': 'AKIA1234567890ABCDEF' }, { allowNames: ['api_secret'] });
  assert.equal(allowed.value.api_secret, '<redacted:KNOWN_KEY_PREFIX>');
  assert.deepEqual(sanitizeEnv({ plain: '<redacted:ENV_VALUE>' }).redactions, []);
  const accessor = {}; Object.defineProperty(accessor, 'TOKEN', { enumerable: true, get() { throw new Error('env-secret'); } });
  throws('ERR_SANITIZE_INPUT', () => sanitizeEnv(accessor));
  const envProxy = new Proxy({ TOKEN: 'x' }, { ownKeys() { throw new Error('proxy-secret'); } });
  assert.throws(() => sanitizeEnv(envProxy), (error) => { code(error, 'ERR_SANITIZE_INPUT'); assert.equal(JSON.stringify(error).includes('proxy-secret'), false); return true; });
  for (const options of [null, [], { extra: true }, { allowNames: ['x', 'x'] }, { allowNames: [, 'x'] }]) throws('ERR_SANITIZE_INPUT', () => sanitizeEnv({ x: 'y' }, options));
});

test('Code B scans PEM variants, all key families, boundaries, and safe indexes', () => {
  const labels = ['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'OPENSSH PRIVATE KEY'];
  for (const label of labels) {
    for (const body of ['QUJD', 'QUJDRA==', 'QUJDRA==\r\nQUJD']) {
      const text = `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
      assert.deepEqual(scanSecrets(text).findings, [{ code: 'PEM_PRIVATE_KEY', index: 0 }]);
    }
  }
  for (const text of [
    '-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----',
    '-----BEGIN PRIVATE KEY-----\nQUJD\n-----END RSA PRIVATE KEY-----',
    'x-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----',
    '-----BEGIN ENCRYPTED PRIVATE KEY-----\nQUJD\n-----END ENCRYPTED PRIVATE KEY-----',
    '-----BEGIN PRIVATE KEY-----\nQUJ!\n-----END PRIVATE KEY-----',
  ]) assert.equal(scanSecrets(text).findings.some(({ code: findingCode }) => findingCode === 'PEM_PRIVATE_KEY'), false);
  const keys = ['AKIA1234567890ABCDEF', 'ASIA1234567890ABCDEF', 'ghp_12345678901234567890', 'github_pat_12345678901234567890', 'sk_live_1234567890123456', 'sb_secret_1234567890123456'];
  assert.deepEqual(scanSecrets(keys).findings.map(({ code: findingCode, index }) => ({ code: findingCode, index })), keys.map((_, index) => ({ code: 'KNOWN_KEY_PREFIX', index })));
  assert.equal(scanSecrets('sha256:' + 'a'.repeat(64) + ' ' + '0'.repeat(200)).ok, true);
  for (const value of ['eyJabcde.fghij.klmno', 'xxeyJabcde.fghij.klmno', 'eyJabcde.fghij.klmnoX']) {
    const result = scanSecrets(value); assert.equal(result.findings.some(({ code: findingCode }) => findingCode === 'JWT_LIKE'), value.startsWith('eyJabcde'));
  }
  const arrayResult = scanSecrets(['AKIA1234567890ABCDEF', 'eyJabcde.fghij.klmno']);
  assert.deepEqual(arrayResult.findings, [{ code: 'KNOWN_KEY_PREFIX', index: 0 }, { code: 'JWT_LIKE', index: 1 }]);
});

test('Code B text options, overlap, mutation, and injected reflective errors are closed', () => {
  const source = 'https://u:p@example.test/AKIA1234567890ABCDEF'; const result = sanitizeText(source, { maxBytes: 12 });
  assert.equal(result.value, '<redacted:UR'); assert.equal(result.redactions.length, 1); assert.equal(result.redactions[0].indexOrName, 0); assert.equal(scanSecrets(result.value).ok, true);
  for (const options of [null, [], { extra: true }]) throws('ERR_SANITIZE_INPUT', () => sanitizeText('x', options));
  throws('ERR_SANITIZE_LIMIT', () => sanitizeText('x', { maxBytes: '1' }));
  for (const options of [{ maxBytes: 1.5 }, { maxBytes: Number.MAX_SAFE_INTEGER + 1 }]) throws('ERR_SANITIZE_LIMIT', () => sanitizeText('x', options));
  const accessor = {}; Object.defineProperty(accessor, 'maxBytes', { enumerable: true, get() { throw new Error('limit-secret'); } });
  assert.throws(() => sanitizeText('x', accessor), (error) => { code(error, 'ERR_SANITIZE_INPUT'); assert.equal(JSON.stringify(error).includes('limit-secret'), false); return true; });
  const input = '😀😀AKIA1234567890ABCDEF'; const copy = input.slice(); sanitizeText(input, { maxBytes: 100 }); assert.equal(input, copy);
  const revoked = Proxy.revocable([], {}); revoked.revoke(); throws('ERR_SANITIZE_INPUT', () => scanSecrets(revoked.proxy));
  throws('ERR_SANITIZE_INPUT', () => scanSecrets(new Proxy([], { ownKeys() { throw new Error('scan-secret'); } })));
});
