# Recovery Harness Utility/Guard Specification

## Requirements

### Requirement: Exact module surface

`scripts/recovery-harness-lib.mjs` MUST export exactly these names and no aliases:

- `REQUIRED_PORTS`
- `renderTemporarySupabaseConfig`
- `parseTemporarySupabaseConfig`
- `createConfigArtifact`
- `canonicalJson`
- `sha256Hex`
- `sanitizeArgv`
- `sanitizeEnv`
- `sanitizeText`
- `scanSecrets`
- `assertRuntimeToken`
- `assertLocalUrl`
- `assertAllowedFlags`
- `assertContainedPath`
- `validateWorktreeEntries`

All functions MUST be deterministic and MUST perform no process execution, filesystem access, clock access, socket access, network access, or input mutation.

#### Scenario: Surface inspection

- GIVEN the library module
- WHEN its named exports are inspected
- THEN the names equal the list above exactly

### Requirement: Closed throwing failure model

Every invalid call MUST throw `RecoveryHarnessError`; no function MUST return an ok/error result union. A thrown error MUST have `name: "RecoveryHarnessError"`, one closed `code`, `message === code`, and a plain `details` object. `details` MAY contain only `field`, `reason`, `path`, `index`, and `findingCode`; no other key is legal. Every present detail value MUST satisfy its closed domain:

```text
field: projectId | text | value | input | argv | env | url | path | entries | ports
reason: invalid | duplicate | unknown | missing | out_of_range | unsupported | cycle | sensitive | outside | protected | not_allowed
findingCode: URL_CREDENTIAL | PEM_PRIVATE_KEY | JWT_LIKE | KNOWN_KEY_PREFIX | SENSITIVE_ENV
```

An optional `index` MUST be a non-negative integer. An optional `path` MUST already be a sanitized canonical POSIX path: absolute for contained-path diagnostics and relative for worktree diagnostics. A raw invalid path containing backslash, NUL, traversal, non-canonical segments, or the wrong absolute/relative form MUST be omitted rather than copied into diagnostics. No error or finding MUST include an actual token, credential, dynamic env name or value, URL text or userinfo, private-key material, matched secret text, or inspected input value.

The `findingCode` domain remains closed and includes `SENSITIVE_ENV` for contextual scanner/post-scan classification. Public `scanSecrets`, whose input contains values but no env names, emits the four shared content codes; it cannot infer `SENSITIVE_ENV`. No diagnostic may use a dynamic env name or value.

The complete error-code enum is:

```text
ERR_CONFIG_PROJECT_ID
ERR_CONFIG_SYNTAX
ERR_CONFIG_DUPLICATE
ERR_CONFIG_UNKNOWN
ERR_CONFIG_MISSING
ERR_CONFIG_PORT
ERR_CANONICAL_TYPE
ERR_CANONICAL_CYCLE
ERR_HASH_INPUT
ERR_SANITIZE_INPUT
ERR_SANITIZE_LIMIT
ERR_TOKEN
ERR_URL
ERR_FLAG
ERR_PATH
ERR_WORKTREE
```

The mapping is closed:

| Code | Rejection branches |
|---|---|
| `ERR_CONFIG_PROJECT_ID` | Missing-type or grammar-invalid `projectId` value after the field is present. |
| `ERR_CONFIG_SYNTAX` | Invalid config call shape that cannot be safely inspected; non-string parser input; CR/CRLF; absent final LF; malformed line; disallowed whitespace; dotted/quoted assignment key; string escape; required-statement order violation; trailing garbage. |
| `ERR_CONFIG_DUPLICATE` | Duplicate `project_id`, table, or fully qualified config key. |
| `ERR_CONFIG_UNKNOWN` | Unknown config input field, ports field, table, or assignment key. |
| `ERR_CONFIG_MISSING` | Missing input field, `project_id`, ports field, table, or required assignment. |
| `ERR_CONFIG_PORT` | Non-number render port; non-safe-integer/range/wrong render value; parser port with `+`, leading zero, non-decimal/noninteger form, out-of-range value, or value unequal to `REQUIRED_PORTS`. |
| `ERR_CANONICAL_TYPE` | Any value or reflective shape outside the canonical domain, including an inspection trap that throws. |
| `ERR_CANONICAL_CYCLE` | A reference encountered again on its current ancestor chain. |
| `ERR_HASH_INPUT` | Hash input other than a string or `Uint8Array`. |
| `ERR_SANITIZE_INPUT` | Invalid sanitizer/scanner input, options shape, option key, allow-name list, or missing split-flag value. A sanitizer internal post-scan invariant breach MAY also use this code with details exactly `{field, reason: "sensitive"}`, where `field` is the affected sanitizer's fixed `argv`, `env`, or `text` label. |
| `ERR_SANITIZE_LIMIT` | `maxBytes` is not a safe integer greater than or equal to zero. |
| `ERR_TOKEN` | Runtime token is not the exact required string grammar. |
| `ERR_URL` | URL input/options/scheme/authority/host/credential/fragment rule fails. |
| `ERR_FLAG` | Argv shape is invalid, an arg is non-string, or an exact denied flag/equal form occurs. |
| `ERR_PATH` | Containment input shape/path canonicality/strict-descendant rule fails. |
| `ERR_WORKTREE` | Worktree input/options/entry/status/tracked/path/duplicate/protected/allowlist rule fails. |

Validation MUST use this precedence when multiple config defects coexist: call shape and lexical syntax, duplicate, unknown, missing, required order, project ID, then port domain/value. Other functions MUST report the first invalid item in input order after validating their outer input/options shape.

#### Scenario: Safe typed rejection

- GIVEN any rejected input containing secret-bearing text
- WHEN the call throws
- THEN `message` equals `code`, the error code follows the table, every detail key/value belongs to the closed domain, and no diagnostic discloses that text

### Requirement: Exact required ports and rendered configuration

`REQUIRED_PORTS` MUST be frozen and contain exactly:

```js
{
  api: 54321,
  db: 54322,
  dbShadow: 54320,
  dbPooler: 54329,
  studio: 54323,
  inbucket: 54324,
  inbucketSmtp: 54325,
  inbucketPop3: 54326,
  analytics: 54327,
}
```

`projectId` MUST be a primitive string matching `[a-z0-9][a-z0-9-]{0,47}`. `ports` MUST be a plain or null-prototype object with exactly the keys above, primitive number values, and values exactly equal to `REQUIRED_PORTS`.

`renderTemporarySupabaseConfig({projectId, ports = REQUIRED_PORTS})` MUST return a primitive string with UTF-8-representable content, LF line endings, and exactly one final LF. It MUST render exactly this template, including blank lines and statement order:

```toml
project_id = "{projectId}"

[api]
port = 54321

[db]
port = 54322
shadow_port = 54320

[db.pooler]
port = 54329

[studio]
port = 54323

[inbucket]
port = 54324
smtp_port = 54325
pop3_port = 54326

[analytics]
port = 54327
```

The closing fence follows the required final LF and is not part of the output.

#### Scenario: Exact rendering

- GIVEN a valid project ID and the default or an exact-value clone of `REQUIRED_PORTS`
- WHEN rendering runs
- THEN the returned string equals the template byte-for-byte after project-ID substitution

#### Scenario: Invalid render input

- GIVEN a missing, unknown, malformed, wrong-type, out-of-range, or wrong-value render input
- WHEN rendering runs
- THEN it throws the mapped config code without mutating the input

### Requirement: Narrow temporary-config parser

`parseTemporarySupabaseConfig(text)` MUST return `{projectId, ports}` where `ports` has exactly the `REQUIRED_PORTS` key/value shape. The parser MUST accept only:

- LF-only input ending in exactly one or more LF characters, with the last character LF;
- empty lines or lines containing only U+0020 spaces;
- full-line or trailing `#` comments outside the project-ID string;
- zero or more U+0020 spaces at line edges and around `=`;
- exact headers `[api]`, `[db]`, `[db.pooler]`, `[studio]`, `[inbucket]`, and `[analytics]`, with no space inside brackets;
- top-level `project_id` with one unescaped double-quoted value;
- unquoted assignment keys exactly where shown in the render template;
- unsigned base-10 integer port lexemes with no leading zero unless the value is exactly `0`.

After comments and blank lines are ignored, the meaningful statements MUST appear in the exact render-template order. `project_id` MUST remain top-level and appear before the first table. Every table and fully qualified key MUST occur exactly once. Parsed project and port values MUST satisfy the renderer domain, including exact required values.

The parser MUST reject CR/CRLF, tabs or other non-U+0020 layout whitespace, missing final LF, dotted or quoted assignment keys, any string escape, unknown/duplicate/missing table or key, leading `+`, leading-zero ambiguity, negative/float/exponent/noninteger ports, out-of-range or wrong ports, reordered meaningful statements, and trailing garbage. It MUST NOT read or merge any other config.

#### Scenario: Accepted narrow presentation

- GIVEN the exact template with additional LF blank lines, U+0020 layout spaces, and `#` comments outside the project-ID string
- WHEN parsing runs
- THEN it returns the exact project ID and required ports

#### Scenario: Rejected parser branch

- GIVEN any lexical, duplicate, unknown, missing, order, project-ID, or port defect listed above
- WHEN parsing runs
- THEN it throws the mapped config code

### Requirement: Config artifact identity

`createConfigArtifact(input)` MUST accept the same exact input as the renderer and return only:

```js
{
  schema: 'actravel.recovery-config/v1',
  projectId,
  ports,
  bytes,
  sha256,
}
```

`ports` MUST be a fresh exact-value object, `bytes` MUST be a fresh `Uint8Array` containing the UTF-8 encoding of the rendered string, and `sha256` MUST be the 64-character lowercase hexadecimal SHA-256 of those bytes. The artifact MUST bind the externally supplied `projectId`, parsed exact ports, rendered bytes, and byte hash; it MUST expose no extra key.

#### Scenario: Bound artifact

- GIVEN valid renderer input
- WHEN an artifact is created
- THEN decoding and parsing `bytes` reproduces `projectId` and `ports`, and `sha256Hex(bytes)` equals `sha256`

### Requirement: Closed canonical JSON domain

`canonicalJson(value)` MUST return a primitive compact JSON string with no trailing newline. It MUST accept only:

- `null`;
- primitive booleans and strings;
- finite safe-integer primitive numbers, with `-0` serialized as `0`;
- dense arrays whose only own keys are `length` and every index from zero through `length - 1`, whose indexes are data properties, and which have no symbol or extra properties;
- objects whose prototype is exactly `Object.prototype` or `null`, whose own keys are enumerable string data properties, and which have no accessors or symbol keys.

Object keys MUST be sorted lexicographically by JavaScript UTF-16 code units. Array order MUST be preserved. JSON string escaping and UTF-8 interpretation MUST follow the Node JSON implementation. Cycles MUST be detected against the current ancestor chain, so repeated acyclic references are accepted. Any reflective inspection that throws MUST become `ERR_CANONICAL_TYPE`; no inspected value may enter error details. A proxy that safely exposes an otherwise accepted shape MAY be accepted because pure JavaScript has no portable proxy detector.

The function MUST reject floats, unsafe or nonfinite numbers, `undefined`, bigint, function, symbol, sparse arrays, extra-property arrays, array accessors, non-plain objects, non-enumerable object properties, object accessors, symbol-key objects, throwing proxies, and cycles.

#### Scenario: Deterministic canonical output

- GIVEN equivalent accepted values with different object insertion order, nested arrays, null-prototype objects, `-0`, and repeated acyclic references
- WHEN canonicalization runs
- THEN keys are UTF-16 sorted, array order is preserved, and output is identical with no newline

#### Scenario: Canonical rejection

- GIVEN any rejected type, reflective shape, or cycle above
- WHEN canonicalization runs
- THEN it throws `ERR_CANONICAL_TYPE` or `ERR_CANONICAL_CYCLE` as applicable

### Requirement: Exact SHA helper

`sha256Hex(input)` MUST accept only a primitive string or `Uint8Array` and return exactly 64 lowercase hexadecimal characters with no `sha256:` prefix. Strings MUST be hashed as UTF-8; a `Uint8Array`, including a Node `Buffer`, MUST be hashed as its exact byte range. It MUST not mutate byte input.

#### Scenario: SHA input domains

- GIVEN equivalent UTF-8 string and byte input
- WHEN each is hashed
- THEN both return the same lowercase 64-character hex value

#### Scenario: Invalid SHA input

- GIVEN any other input type
- WHEN hashing runs
- THEN it throws `ERR_HASH_INPUT`

### Requirement: Shared sanitizer detection and placeholder rules

All sanitizers MUST return `{value, redactions}` without mutating input. Every redaction MUST be `{code, indexOrName}` with no extra key, and every replacement MUST be exactly `<redacted:CODE>` using that redaction's code.

Redaction selection MUST apply this outer-context precedence before shared content detection:

1. A value consumed by an exact sensitive split or inline argv flag MUST be replaced as a whole by `<redacted:FLAG_VALUE>`, even when it contains URL credentials or another shared candidate. It emits exactly one `FLAG_VALUE` redaction and no nested redaction.
2. A value belonging to a non-allowed sensitive env name MUST be replaced as a whole by `<redacted:ENV_VALUE>`, even when it contains URL credentials or another shared candidate. It emits exactly one `ENV_VALUE` redaction and no nested redaction.
3. Every other argv/text value, plus every env value that reaches shared detection, MUST use the shared detectors. A credential-bearing URL candidate in such a value is replaced as a whole by `<redacted:URL_CREDENTIAL>` and suppresses nested detectors within that candidate.

Exactly one outer-context redaction is emitted for a span selected by step 1 or 2. An allowed env name bypasses step 2 only and therefore still receives step 3 shared detection.

The fixed codes and detection classes are:

| Code | Exact detection class |
|---|---|
| `FLAG_VALUE` | A value belonging to an exact sensitive flag. |
| `ENV_VALUE` | A complete value belonging to a sensitive env name. |
| `PEM_PRIVATE_KEY` | The exact line-bounded, same-label private-key block grammar below. |
| `URL_CREDENTIAL` | The exact maximal-candidate and WHATWG parse grammar below. |
| `JWT_LIKE` | An ASCII-token-bounded three-segment base64url token matching `eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}`. |
| `KNOWN_KEY_PREFIX` | An ASCII-token-bounded token matching `AKIA[0-9A-Z]{16}`, `ASIA[0-9A-Z]{16}`, `gh[pousr]_[A-Za-z0-9]{20,}`, `github_pat_[A-Za-z0-9_]{20,}`, `sk_(live|test)_[A-Za-z0-9]{16,}`, or `sb_secret_[A-Za-z0-9_-]{16,}`. |

For URL detection, a delimiter is an ECMAScript whitespace/line-terminator code unit or a code unit in U+0000-U+001F or U+007F-U+009F. A URL candidate is the maximal substring containing no delimiter whose left boundary is input start or a delimiter and whose first code units are exactly one of the case-sensitive lowercase prefixes `http://`, `https://`, `postgres://`, or `postgresql://`. Its right boundary is input end or a delimiter, so any adjacent trailing punctuation belongs to the candidate and any adjacent leading non-delimiter prevents the scheme from beginning a candidate. The complete candidate MUST be parsed with Node's WHATWG `URL`. It is `URL_CREDENTIAL` only when parsing succeeds and the parsed `username` or `password` is nonempty. Replacement consumes the complete candidate, including scheme, userinfo, `@`, authority, port, path, query, fragment, and any other non-delimiter suffix accepted as part of the candidate. An invalid WHATWG URL is not a URL finding or URL redaction, although another detector MAY independently match content within it. Empty userinfo, an `@` only in path/query/fragment, a relative/host-only value, an uppercase or unsupported scheme, a scheme preceded by a non-delimiter, or a malformed candidate is not this class.

For PEM detection, `LABEL` is exactly one of `PRIVATE KEY`, `RSA PRIVATE KEY`, `EC PRIVATE KEY`, or `OPENSSH PRIVATE KEY`. `EOL` is LF or CRLF. A base64 body line is a nonempty valid padded-base64 line matching `(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?`, with at least one quartet or terminal group. A block is exactly `-----BEGIN LABEL-----`, followed by `EOL`, one or more base64 body lines each followed by `EOL`, and `-----END LABEL-----` with the same `LABEL`. The BEGIN marker MUST start at input start or immediately after LF; the END marker's final hyphen MUST be followed by input end, LF, or CRLF. Markers and body lines permit no leading/trailing spaces or extra characters; line separators within one block MAY independently be LF or CRLF. Replacement consumes from the BEGIN marker's first hyphen through the matching END marker's final hyphen and does not consume a preceding or following line separator. Unsupported labels including `ENCRYPTED PRIVATE KEY`, public/certificate labels, mismatched labels, zero body lines, blank or non-base64 body lines, inline markers, missing delimiters, extra marker text, and lone-CR line endings are not this class.

ASCII token boundaries for JWT/key detection mean the adjacent character, when present, is not `[A-Za-z0-9_-]`. Shared detection precedence for overlapping spans MUST be `PEM_PRIVATE_KEY`, `URL_CREDENTIAL`, `JWT_LIKE`, then `KNOWN_KEY_PREFIX`; ties use earliest start, then longest span. A valid credential URL suppresses nested secret-like query/path content and produces only its one URL redaction. Redactions MUST be returned in source order. Exact placeholders, including `<redacted:FLAG_VALUE>`, `<redacted:ENV_VALUE>`, and `<redacted:URL_CREDENTIAL>`, MUST be accepted as clean. Ordinary hexadecimal strings and `sha256:` followed by exactly 64 lowercase hexadecimal characters MUST remain unchanged and MUST not be findings solely because of their length or hex content.

#### Scenario: Shared deterministic replacement

- GIVEN text containing each detection class and ordinary SHA/hex text
- WHEN any sanitizer applies shared text detection
- THEN each sensitive span has the exact placeholder and metadata while ordinary SHA/hex text is unchanged

#### Scenario: Complete credential-URL replacement

- GIVEN a non-sensitive argv/text value containing a maximal exact-scheme candidate that WHATWG parses with a nonempty username or password
- WHEN shared text detection sanitizes it
- THEN the complete URL token is replaced by exactly `<redacted:URL_CREDENTIAL>`, exactly one redaction is emitted, and no scheme, `@`, authority, path, query, or fragment survives

#### Scenario: Context beats nested URL credentials

- GIVEN a sensitive split/inline argv value or non-allowed sensitive env value containing a credential-bearing URL
- WHEN its contextual sanitizer runs
- THEN the entire value receives exactly one `FLAG_VALUE` or `ENV_VALUE` redaction respectively, with no nested `URL_CREDENTIAL` redaction

#### Scenario: Exact URL and PEM negatives

- GIVEN an invalid WHATWG URL candidate, a candidate without parsed userinfo, a scheme adjacent to a leading non-delimiter, or a PEM near-match with unsupported/mismatched labels, invalid boundaries, no valid body line, or invalid line endings
- WHEN shared detection runs
- THEN that near-match is not reported by that detector, while any independently matching detector still applies

### Requirement: Argv sanitizer

Sensitive flags are exactly `--token`, `--password`, `--db-url`, `--access-token`, and `--service-role-key`, matched case-sensitively as either a complete arg followed by its value or `--name=value`. No near-match is sensitive by flag name alone.

`sanitizeArgv(argv, options = {})` MUST accept a dense, extra-property-free array of primitive strings and an omitted or plain/null-prototype empty options object. Unknown options are rejected. A split sensitive flag without a following arg is rejected. Its complete value MUST be a fresh array. Split sensitive values become `<redacted:FLAG_VALUE>` at the original value index; inline values preserve `--name=` and replace the complete remainder. The consumed sensitive value is not shared-scanned before replacement and produces only its one outer-context redaction. Non-sensitive args and preserved flag text MUST receive the shared text detections. `indexOrName` MUST be the zero-based argv index containing the redacted value or span.

#### Scenario: Argv forms and immutability

- GIVEN split forms, equals forms, near-match flags, and shared text detections
- WHEN argv is sanitized
- THEN only exact sensitive values and detected spans are replaced, indexes are safe, and input is unchanged

### Requirement: Environment sanitizer

An env name is sensitive when it is one of `DATABASE_URL`, `DB_URL`, `POSTGRES_URL`, or `POSTGRESQL_URL`, ignoring ASCII case, or when it matches either `(^|[_-])(PASSWORD|TOKEN|SECRET|KEY)([_-]|$)` or `(^|[_-])(DATABASE|DB|POSTGRES|POSTGRESQL)[_-]?URL([_-]|$)`, ignoring ASCII case.

`sanitizeEnv(env, options = {})` MUST accept a plain/null-prototype object with enumerable string data-property names and primitive string values. It MUST reject accessors, symbol keys, and inspection failures. Options MUST be a plain/null-prototype object containing no key other than optional `allowNames`. `allowNames` defaults to an empty dense, extra-property-free array of unique primitive strings. An exact case-sensitive name in `allowNames` bypasses only name-based whole-value replacement; shared text detection still applies to its value.

The returned `value` MUST be a fresh null-prototype object preserving every input name. A non-allowed sensitive name's complete value becomes `<redacted:ENV_VALUE>` without prior shared scanning and produces only its one outer-context redaction. Other values receive shared text detection. `indexOrName` MUST be the env property name. The postcondition MUST inspect env properties in lexicographic JavaScript UTF-16 name order, require every non-allowed sensitive value to equal `<redacted:ENV_VALUE>`, and require the shared-content scan of returned values to be clean. Success is impossible unless both postconditions hold. An internal invariant breach MAY throw `ERR_SANITIZE_INPUT` with details exactly `{field: "env", reason: "sensitive"}`; it MUST NOT include the env name, env value, matched text, or a fault-injection-only public branch.

#### Scenario: Env patterns and explicit allow names

- GIVEN exact/pattern-sensitive names, ordinary names, and an explicit allow-name entry
- WHEN env is sanitized
- THEN sensitive values are replaced, the exact allowed name bypasses only whole-value replacement, content detections still apply, and input is unchanged

### Requirement: Bounded text sanitizer

`sanitizeText(text, {maxBytes = 16384} = {})` MUST accept a primitive string and a plain/null-prototype options object with no key other than `maxBytes`. `maxBytes` MUST be a safe integer greater than or equal to zero.

It MUST apply all shared text replacements to the complete input before hashing or truncation. It MUST return exactly:

```js
{
  value,
  fullSha256,
  truncated,
  retainedBytes,
  redactions,
}
```

`fullSha256` MUST be the 64-character lowercase SHA-256 of the complete sanitized UTF-8 bytes. If those bytes exceed `maxBytes`, `value` MUST be the longest UTF-8 prefix no longer than `maxBytes` that ends at a code-point boundary; otherwise it is the complete sanitized string. `truncated` states whether bytes were removed. `retainedBytes` is exactly the UTF-8 byte length of `value`. No truncation marker is added, so no marker is counted in `retainedBytes`. Text `indexOrName` values MUST be zero-based UTF-16 code-unit indexes into the original input, including redactions beyond the retained prefix.

#### Scenario: UTF-8 bounded output

- GIVEN sensitive text and a byte limit that intersects a multibyte character
- WHEN text is sanitized
- THEN secrets are replaced before the full hash is computed and retained output ends at the preceding UTF-8 code-point boundary with no marker

#### Scenario: Invalid text limit

- GIVEN a negative, fractional, unsafe, non-number, or unknown-option limit
- WHEN text sanitization runs
- THEN it throws `ERR_SANITIZE_LIMIT` for the value or `ERR_SANITIZE_INPUT` for the options shape/key

### Requirement: Secret scanner

`scanSecrets(input)` MUST accept only a primitive string or a dense, extra-property-free array of primitive strings. It MUST apply the four shared content detections, not infer the context-only `FLAG_VALUE`, `ENV_VALUE`, or `SENSITIVE_ENV` classes from value-only input, and return exactly `{ok, findings}`. Each finding MUST be `{code, index}` with no extra key and no matched text. For string input, `index` is the zero-based UTF-16 code-unit match start. For array input, `index` is the zero-based element index; multiple classes in one element produce separate findings at the same element index. Findings MUST be ordered by source/element order and detection precedence. `ok` is true exactly when `findings` is empty. Exact sanitizer placeholders, explicitly including `<redacted:FLAG_VALUE>`, `<redacted:ENV_VALUE>`, and `<redacted:URL_CREDENTIAL>`, MUST not be findings. Every unredacted candidate satisfying the exact URL, PEM, JWT, or known-key grammar MUST produce its corresponding finding.

This object is a scan-domain result, not an ok/error union. A valid input with candidates returns `{ok:false,findings}` and MUST NOT throw. Invalid scanner input throws `ERR_SANITIZE_INPUT`. `sanitizeArgv` MUST post-scan its complete returned array, `sanitizeEnv` MUST post-scan all returned values in sorted-name order, and `sanitizeText` MUST post-scan the complete sanitized text before hashing or truncation. Every sanitizer MUST return success only when that result has `ok:true`; env sanitization MUST also enforce its name-based `SENSITIVE_ENV` replacement postcondition. If an implementation violates either internal invariant, it MAY throw `ERR_SANITIZE_INPUT` with details exactly `{field, reason: "sensitive"}`, where `field` is `argv`, `env`, or `text` for the affected sanitizer. No fault-injection-only public branch or baseline assertion is required, and no invariant diagnostic may include a secret, dynamic env name/value, URL, key body, or matched text.

#### Scenario: Clean and finding results

- GIVEN sanitized placeholders, ordinary hex/SHA text, or candidate strings containing each shared secret class including an unredacted credential-bearing URL
- WHEN scanning runs
- THEN clean input returns `{ok:true,findings:[]}` and candidates return ordered code/index findings without secret values

### Requirement: Runtime token guard

`assertRuntimeToken(token)` MUST return `true` only for a primitive string matching exactly `sha256:[0-9a-f]{64}`. Uppercase hex, missing prefix, whitespace, additional text, and non-string input MUST throw `ERR_TOKEN`.

#### Scenario: Exact runtime token

- GIVEN exact and near-match token values
- WHEN the guard runs
- THEN only the exact lowercase prefixed grammar returns true

### Requirement: Literal local URL guard

`assertLocalUrl(url, {allowCredentials = false} = {})` MUST accept a primitive URL string and a plain/null-prototype options object containing no key other than primitive-boolean `allowCredentials`. It MUST require an explicit lowercase `http://`, `https://`, `postgres://`, or `postgresql://` scheme and a raw authority whose hostname is exactly `localhost`, `127.0.0.1`, or `[::1]`, optionally with a syntactically valid decimal port. It MAY accept path and query components. It MUST reject fragments.

Credentials MUST be rejected by default and accepted only when `allowCredentials` is exactly `true`. Validation MUST inspect the raw authority before URL normalization so host-only input, case/trailing-dot variants, percent-encoded hosts, and normalized alternate numeric forms such as `127.1`, `2130706433`, hexadecimal, octal, or mixed IPv4 are rejected. Any parse or rule failure throws `ERR_URL` without including URL text.

#### Scenario: Literal loopback URLs

- GIVEN each allowed scheme and literal host, with valid path/query and optional port
- WHEN the guard runs
- THEN it returns true

#### Scenario: URL rejection and credential opt-in

- GIVEN host-only, remote, normalized numeric, fragment, invalid-port, or credential-bearing input
- WHEN the guard runs
- THEN it throws `ERR_URL`, except exact credentials are accepted when `allowCredentials:true`

### Requirement: Denied flag guard

`assertAllowedFlags(argv)` MUST accept a dense, extra-property-free array of primitive strings and return `true` only when no arg equals `--linked`, `--project-ref`, `--remote`, or `--include-linked`, and no arg starts with one of those exact names followed by `=`. Prefix near-matches such as `--remote-cache` are not denied by this guard. Invalid arrays or non-string args and denied forms throw `ERR_FLAG` with only the arg `index` and fixed labels.

#### Scenario: Exact denied forms

- GIVEN each exact/equal denied form, allowed args, prefix near-matches, and non-string args
- WHEN the guard runs
- THEN denied or invalid values throw `ERR_FLAG` and other strings return true

### Requirement: Strict contained-path guard

`assertContainedPath({repoRealPath, candidateRealPath})` MUST accept exactly those two primitive-string fields. Both MUST already be canonical absolute POSIX realpath strings: they start with `/`, contain no NUL or backslash, and equal `path.posix.normalize(value)` with no removable trailing slash except `/`. `candidateRealPath` MUST be a strict descendant of `repoRealPath`; equality and any outside path are rejected. Success returns `true`; every rejection throws `ERR_PATH`, with only a safe `field`, fixed `reason`, and optional diagnosed `path`.

This pure function performs no filesystem access and makes no claim that either path exists, that realpath was actually called, or that symlinks are absent.

#### Scenario: Strict lexical containment of realpaths

- GIVEN canonical absolute POSIX strings where the candidate is a strict descendant
- WHEN the guard runs
- THEN it returns true without I/O

#### Scenario: Unsafe path input

- GIVEN equality, outside, relative, non-canonical, backslash, NUL, or invalid-shape input
- WHEN the guard runs
- THEN it throws `ERR_PATH` and makes no symlink claim

### Requirement: Exact worktree guard

`validateWorktreeEntries(entries, {allowedPaths, protectedPaths})` MUST accept dense, extra-property-free arrays. Each `entries` item MUST be a plain/null-prototype object with exactly enumerable data properties `{path, status, tracked}` and no symbol/accessor properties. `status` MUST be exactly one of `M`, `A`, `D`, `R`, `C`, `U`, `?`, or `!`; `tracked` MUST be boolean. `M/A/D/R/C/U` require `tracked:true`; `?/!` require `tracked:false`.

Every entry path and every allow/protect list item MUST be a primitive, nonempty canonical POSIX relative path: no leading `/`, backslash, NUL, empty segment, `.` segment, `..` segment, duplicate separator, or trailing slash. `allowedPaths` and `protectedPaths` MUST each contain unique paths. Entry paths MUST also be unique.

Every supplied entry, including `!`, MUST occur by exact string equality in `allowedPaths`. Prefix containment is insufficient. Any entry exactly in `protectedPaths` MUST be rejected even if also allowed. Protected checking takes precedence over allow checking. Success returns `true`; all invalid shape, consistency, path, duplicate, protected, or disallowed branches throw `ERR_WORKTREE` with only fixed labels and safe entry `index`/`path`.

#### Scenario: Exact allowed entries

- GIVEN unique valid entries covering the accepted status/tracked pairs and exact allowed paths with no protected collision
- WHEN validation runs
- THEN it returns true

#### Scenario: Worktree rejection

- GIVEN an invalid shape/status/tracked pair/path, duplicate, protected entry, or path absent from the exact allowlist
- WHEN validation runs
- THEN it throws `ERR_WORKTREE`, with protected entries rejected before allowlist acceptance

### Requirement: Explicit micro-slice boundary

This change MUST NOT define or implement process execution, command adapters, receipts, invariant categories, cleanup, manifests, SQL, runners, A/B lifecycle, Docker, Supabase, Postgres, sockets, network, provider access, `recovery:local`, migrations, application behavior, generated types, dependencies, lockfile changes, image behavior, or integration execution. Follow-up slices own those concerns.

#### Scenario: Core-only interpretation

- GIVEN every utility/guard test passes
- WHEN recovery readiness or Week 01 closure is evaluated
- THEN core PASS is insufficient and the recovery status remains not ready and not closed
