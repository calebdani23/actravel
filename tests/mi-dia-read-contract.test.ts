import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import test from "node:test"

const migrationPath = "db/migrations/0089_mi_dia_read_contract.sql"
const signature = "public.read_mi_dia_page(text,uuid,integer,text,text)"
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

type CommandResult = {
  status: number | null
  stdout: Buffer | null
  stderr: Buffer | null
  error?: Error
}
type CommandRunner = (
  command: string,
  args: readonly string[],
  options: { cwd: string; encoding: "buffer" },
) => CommandResult
type SnapshotRow = {
  path: string
  state: "regular" | "absent"
  bytes: number
  sha256: string | null
  status: string[]
  stage: string[]
}
type SnapshotManifest = {
  schema: "mi-dia-accounting.v1"
  phase: "before" | "after"
  root: string
  paths: string[]
  pathsNulSha256: string
  statusSha256: string
  stageSha256: string
  rows: SnapshotRow[]
}
type Counts = Record<string, { additions: number; deletions: number }>

const defaultRunner: CommandRunner = (command, args, options) =>
  spawnSync(command, [...args], options) as CommandResult

function splitNul(value: Buffer): string[] {
  if (value.length === 0) return []
  if (value.at(-1) !== 0) throw new Error("NUL terminator required")
  const records = value.toString("utf8").split("\0")
  records.pop()
  if (records.some((record) => record.length === 0)) throw new Error("empty NUL record")
  return records
}

function assertAllowedGitArgs(args: readonly string[]): "diff" | "read" {
  const exact = (expected: readonly string[]) =>
    args.length === expected.length && args.every((value, index) => value === expected[index])
  if (exact(["rev-parse", "--show-toplevel"])) return "read"
  if (args.length > 5 && args[0] === "status" && args[1] === "--porcelain=v2" && args[2] === "-z" &&
      args[3] === "--untracked-files=all" && args[4] === "--") return "read"
  if (args.length > 4 && args[0] === "ls-files" && args[1] === "--stage" &&
      args[2] === "-z" && args[3] === "--") return "read"
  if (args.length === 8 && args[0] === "diff" && args[1] === "--no-index" &&
      args[2] === "--no-renames" && args[3] === "--numstat" && args[4] === "-z" &&
      args[5] === "--") return "diff"
  throw new Error("Git command is outside the read-only accounting allowlist")
}

function runReadOnlyGit(
  cwd: string,
  args: readonly string[],
  runner: CommandRunner = defaultRunner,
): { status: number; stdout: Buffer } {
  const kind = assertAllowedGitArgs(args)
  const result = runner("git", args, { cwd, encoding: "buffer" })
  if (result.error) throw result.error
  const accepted = kind === "diff" ? [0, 1] : [0]
  if (result.status === null || !accepted.includes(result.status)) throw new Error("Git command failed closed")
  return { status: result.status, stdout: result.stdout ?? Buffer.alloc(0) }
}

function validateOwnedManifest(root: string, manifest: Buffer): string[] {
  const paths = splitNul(manifest)
  if (paths.length === 0) throw new Error("owned manifest is empty")
  if (new Set(paths).size !== paths.length) throw new Error("duplicate owned path")
  if (paths.join("\0") !== [...paths].sort().join("\0")) throw new Error("owned manifest is not sorted")
  for (const path of paths) {
    const parts = path.split("/")
    const absolute = resolve(root, path)
    if (isAbsolute(path) || parts.includes("..") || parts.includes("") ||
        !absolute.startsWith(`${resolve(root)}${sep}`)) throw new Error("owned path escapes repository")
    let current = root
    for (const part of parts) {
      current = join(current, part)
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error("symlink owned path")
    }
    if (existsSync(absolute) && !lstatSync(absolute).isFile()) throw new Error("non-regular owned path")
  }
  return paths
}

function statusPath(record: string): string | null {
  if (record.startsWith("? ") || record.startsWith("! ")) return record.slice(2)
  if (record.startsWith("1 ")) return record.split(" ").slice(8).join(" ")
  return null
}

function stagePath(record: string): string | null {
  const delimiter = record.indexOf("\t")
  return delimiter === -1 ? null : record.slice(delimiter + 1)
}

function snapshot(root: string, baseline: string, phase: "before" | "after", manifestBytes: Buffer) {
  const paths = validateOwnedManifest(root, manifestBytes)
  const status = runReadOnlyGit(root, ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", ...paths]).stdout
  const stage = runReadOnlyGit(root, ["ls-files", "--stage", "-z", "--", ...paths]).stdout
  const statusRecords = splitNul(status), stageRecords = splitNul(stage)
  const rows = paths.map<SnapshotRow>((path) => {
    const source = join(root, path)
    const metadata = {
      status: statusRecords.filter((record) => statusPath(record) === path),
      stage: stageRecords.filter((record) => stagePath(record) === path),
    }
    if (!existsSync(source)) return { path, state: "absent", bytes: 0, sha256: null, ...metadata }
    const bytes = readFileSync(source), destination = join(baseline, phase, path)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
    return { path, state: "regular", bytes: bytes.length, sha256: sha256(bytes), ...metadata }
  })
  const manifest: SnapshotManifest = {
    schema: "mi-dia-accounting.v1",
    phase,
    root,
    paths,
    pathsNulSha256: sha256(manifestBytes),
    statusSha256: sha256(status),
    stageSha256: sha256(stage),
    rows,
  }
  const bytes = Buffer.from(JSON.stringify(manifest))
  writeFileSync(join(baseline, `${phase}-manifest.json`), bytes)
  return { manifest, bytes, hash: sha256(bytes) }
}

function verifySealedBefore(baseline: string, manifest: SnapshotManifest) {
  for (const row of manifest.rows) {
    const path = join(baseline, "before", row.path)
    if (row.state === "absent") assert.equal(existsSync(path), false, row.path)
    else assert.equal(sha256(readFileSync(path)), row.sha256, row.path)
  }
}

function normalizeDiffPath(path: string, cwd: string, before: string, after: string): string {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(cwd, path)
  for (const root of [before, after]) {
    const candidate = relative(resolve(root), absolute)
    if (candidate && candidate !== ".." && !candidate.startsWith(`..${sep}`) && !isAbsolute(candidate)) return candidate
  }
  throw new Error(`numstat path is outside the owned snapshots: ${path}`)
}

function parseNumstat(output: Buffer, cwd: string, before: string, after: string, paths: string[]): Counts {
  const counts = Object.fromEntries(paths.map((path) => [path, { additions: 0, deletions: 0 }])) as Counts
  const seen = new Set<string>(), records = splitNul(output)
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const first = record.indexOf("\t"), second = record.indexOf("\t", first + 1)
    if (first <= 0 || second <= first + 1) throw new Error("ambiguous numstat record")
    const additions = record.slice(0, first), deletions = record.slice(first + 1, second)
    if (additions === "-" || deletions === "-") throw new Error("binary numstat rejected")
    if (!/^\d+$/.test(additions) || !/^\d+$/.test(deletions)) throw new Error("invalid numstat count")
    const rawPath = record.slice(second + 1)
    let path: string
    if (rawPath === "") {
      const beforePath = records[index + 1], afterPath = records[index + 2]
      if (!beforePath || !afterPath) throw new Error("ambiguous paired numstat path")
      if (beforePath === "/dev/null" || afterPath === "/dev/null") {
        if ((beforePath === "/dev/null") === (afterPath === "/dev/null")) throw new Error("ambiguous absent numstat path")
        if (beforePath === "/dev/null" && (Number(additions) === 0 || Number(deletions) !== 0)) throw new Error("invalid create numstat")
        if (afterPath === "/dev/null" && (Number(additions) !== 0 || Number(deletions) === 0)) throw new Error("invalid delete numstat")
        path = normalizeDiffPath(beforePath === "/dev/null" ? afterPath : beforePath, cwd, before, after)
      } else {
        const beforeRelative = normalizeDiffPath(beforePath, cwd, before, after)
        const afterRelative = normalizeDiffPath(afterPath, cwd, before, after)
        if (beforeRelative !== afterRelative) throw new Error("rename inference rejected")
        path = beforeRelative
      }
      index += 2
    } else path = normalizeDiffPath(rawPath, cwd, before, after)
    if (!(path in counts) || seen.has(path)) throw new Error("unowned or duplicate numstat path")
    seen.add(path)
    counts[path] = { additions: Number(additions), deletions: Number(deletions) }
  }
  return counts
}

function ownedStateHash(root: string, paths: string[]): string {
  const hash = createHash("sha256")
  for (const path of paths) {
    hash.update(path).update("\0")
    const absolute = join(root, path)
    if (!existsSync(absolute)) hash.update("absent\0")
    else hash.update("regular\0").update(readFileSync(absolute)).update("\0")
  }
  return hash.digest("hex")
}

const verifierProgram = String.raw`
const {spawnSync}=require("node:child_process");
const {createHash}=require("node:crypto");
const {copyFileSync,existsSync,mkdirSync,readFileSync}=require("node:fs");
const {dirname,join}=require("node:path");
const hash=value=>createHash("sha256").update(value).digest("hex");
const [root,baseline,encodedPaths,expectedBeforeHash]=process.argv.slice(1);
const paths=JSON.parse(encodedPaths),beforeBytes=readFileSync(join(baseline,"before-manifest.json"));
if(hash(beforeBytes)!==expectedBeforeHash)throw new Error("sealed before manifest changed");
const before=JSON.parse(beforeBytes),afterRoot=join(baseline,"verifier-after");
for(const row of before.rows){const sealed=join(baseline,"before",row.path);if(row.state==="regular"&&hash(readFileSync(sealed))!==row.sha256)throw new Error("sealed byte changed");const source=join(root,row.path);if(existsSync(source)){const target=join(afterRoot,row.path);mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);}}
const statusArgs=["status","--porcelain=v2","-z","--untracked-files=all","--",...paths];
const stageArgs=["ls-files","--stage","-z","--",...paths];
const run=args=>{const result=spawnSync("git",args,{cwd:root,encoding:"buffer"});if(result.error||result.status!==0)throw result.error||new Error("read failed");return result.stdout;};
const statusBefore=run(statusArgs),stageBefore=run(stageArgs);
const diff=spawnSync("git",["diff","--no-index","--no-renames","--numstat","-z","--",join(baseline,"before"),afterRoot],{cwd:baseline,encoding:"buffer"});
if(diff.error||![0,1].includes(diff.status))throw diff.error||new Error("diff failed");
const statusAfter=run(statusArgs),stageAfter=run(stageArgs);
const rows=paths.map(path=>{const source=join(root,path);if(!existsSync(source))return{path,state:"absent",bytes:0,sha256:null};const bytes=readFileSync(source);return{path,state:"regular",bytes:bytes.length,sha256:hash(bytes)}});
process.stdout.write(JSON.stringify({diff:diff.stdout.toString("base64"),statusBefore:hash(statusBefore),statusAfter:hash(statusAfter),stageBefore:hash(stageBefore),stageAfter:hash(stageAfter),afterManifest:hash(Buffer.from(JSON.stringify({schema:"mi-dia-verifier-after.v1",root,paths,rows})))}));
`

function independentVerify(root: string, baseline: string, paths: string[], beforeHash: string) {
  const result = spawnSync(process.execPath, ["-e", verifierProgram, root, baseline, JSON.stringify(paths), beforeHash], { encoding: "utf8" })
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr)
  const receipt = JSON.parse(result.stdout) as {
    diff: string
    statusBefore: string
    statusAfter: string
    stageBefore: string
    stageAfter: string
    afterManifest: string
  }
  assert.equal(receipt.statusAfter, receipt.statusBefore)
  assert.equal(receipt.stageAfter, receipt.stageBefore)
  const counts = parseNumstat(Buffer.from(receipt.diff, "base64"), baseline, join(baseline, "before"), join(baseline, "verifier-after"), paths)
  return { counts, hash: sha256(JSON.stringify({ ...receipt, diff: sha256(Buffer.from(receipt.diff, "base64")), counts })) }
}

test("0089 exposes one closed stable definer read contract, exact index, scopes, and manual type", () => {
  const sql = readFileSync(migrationPath, "utf8"), types = readFileSync("lib/supabase/database.types.ts", "utf8")
  assert.equal(sql.match(/create or replace function public\.read_mi_dia_page/g)?.length, 1)
  assert.match(sql, /language plpgsql stable security definer set search_path = ''/i)
  assert.match(sql, new RegExp(`alter function ${signature.replace(/[().]/g, "\\$&")} owner to postgres`, "i"))
  assert.ok(sql.indexOf(`revoke all on function ${signature}`) < sql.indexOf(`grant execute on function ${signature}`))
  assert.match(sql, /from public, anon, authenticated, service_role;[\s\S]*to authenticated;/i)
  assert.match(sql, /create index tasks_mi_dia_active_due_id_idx\s+on public\.tasks \(due_at asc, id asc\)\s+include \(owner_id, task_kind, status, lead_id, quote_id\)\s+where task_kind in \('follow_up','first_contact','quote_follow_up'\)\s+and status in \('pending','in_progress'\);/i)
  assert.match(sql, /result_scope := case when 'admin'=any\(actor_roles\) then 'all' when 'manager'=any\(actor_roles\) then 'team' else 'self' end;[\s\S]*'scope',result_scope/i)
  assert.doesNotMatch(sql, /\b(insert into|update|delete from|create policy|grant (select|insert|update|delete))\b/i)
  for (const value of ["auth.uid()", "auth.role()", "public.task_actor_can_manage(t.owner_id)", "public.crm_advisor_can_access_live_opportunity(t.lead_id)", "public.crm_can_read_quote(t.quote_id)", "America/Mexico_City", "effective_limit + 1"]) assert.ok(sql.includes(value), value)
  const rpc = types.slice(types.indexOf("read_mi_dia_page:"), types.indexOf("approve_follow_up_task_plan:"))
  for (const value of ["p_reference_time_text: string", "p_expected_actor_id: string", "p_limit: number", "p_after_due_at_text: string | null", "p_after_id_text: string | null", "Returns: Json"]) assert.ok(rpc.includes(value), value)
  assert.match(rpc, /^read_mi_dia_page: \{\s*Args: \{\s*p_reference_time_text: string\s*p_expected_actor_id: string\s*p_limit: number\s*p_after_due_at_text: string \| null\s*p_after_id_text: string \| null\s*}\s*Returns: Json\s*}\s*$/)
})

test("protected migration manifest is exact and current", () => {
  const rows = readFileSync("openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256", "utf8").trim().split("\n")
  assert.deepEqual(rows.map((row) => row.match(/db\/migrations\/(\d{4})_/)?.[1]), Array.from({ length: 28 }, (_, index) => String(index + 61).padStart(4, "0")))
  for (const row of rows) { const [digest, path] = row.split(/\s+/); assert.equal(sha256(readFileSync(path)), digest, path) }
})

test("snapshot accounting proves mixed work, rejection boundaries, independent verification, and cleanup", () => {
  const worktree = mkdtempSync(join(tmpdir(), "mi-dia-accounting-worktree-"))
  const baselineParent = join(tmpdir(), "opencode")
  mkdirSync(baselineParent, { recursive: true })
  const baseline = mkdtempSync(join(baselineParent, "actravel-mi-dia-fixture-"))
  const setupGit = (...args: string[]) => execFileSync("git", args, { cwd: worktree, encoding: "buffer" })
  const paths = ["created", "deleted", "space name", "staged", "tracked", "unstaged", "untracked"].sort()
  const manifestBytes = Buffer.from(paths.map((path) => `${path}\0`).join(""))
  try {
    setupGit("init", "-q")
    for (const path of ["deleted", "space name", "staged", "tracked", "unstaged"]) writeFileSync(join(worktree, path), "base\n")
    setupGit("add", ".")
    setupGit("-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-qm", "base")
    writeFileSync(join(worktree, "staged"), "base\nstaged baseline\n")
    setupGit("add", "staged")
    writeFileSync(join(worktree, "unstaged"), "base\nunstaged baseline\n")
    writeFileSync(join(worktree, "untracked"), "untracked baseline\n")

    assert.equal(runReadOnlyGit(worktree, ["rev-parse", "--show-toplevel"]).stdout.toString().trim(), worktree)
    assert.ok(relative(worktree, baseline).startsWith(".."))
    assert.ok(relative(baseline, worktree).startsWith(".."))
    writeFileSync(join(baseline, "owned-paths.nul"), manifestBytes)
    assert.deepEqual(validateOwnedManifest(worktree, readFileSync(join(baseline, "owned-paths.nul"))), paths)
    const before = snapshot(worktree, baseline, "before", manifestBytes)
    assert.equal(before.manifest.rows.find((row) => row.path === "created")?.state, "absent")
    assert.match(before.manifest.rows.find((row) => row.path === "staged")?.status[0] ?? "", /^1 M/)
    assert.match(before.manifest.rows.find((row) => row.path === "unstaged")?.status[0] ?? "", /^1 \.M/)
    assert.equal(before.manifest.rows.find((row) => row.path === "untracked")?.status[0], "? untracked")
    assert.equal(before.manifest.rows.find((row) => row.path === "tracked")?.stage.length, 1)

    for (const path of ["space name", "staged", "tracked", "unstaged", "untracked"]) writeFileSync(join(worktree, path), "slice\n", { flag: "a" })
    writeFileSync(join(worktree, "created"), "slice\n")
    rmSync(join(worktree, "deleted"))
    const legacy = setupGit("diff", "--numstat", "-z", "HEAD", "--", ...paths)
    assert.equal(legacy.includes(Buffer.from("untracked\0")), false)
    assert.equal(legacy.includes(Buffer.from("created\0")), false)

    const after = snapshot(worktree, baseline, "after", manifestBytes)
    verifySealedBefore(baseline, before.manifest)
    assert.equal(after.manifest.rows.find((row) => row.path === "created")?.state, "regular")
    assert.equal(after.manifest.rows.find((row) => row.path === "deleted")?.state, "absent")
    const statusBefore = runReadOnlyGit(worktree, ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", ...paths]).stdout
    const stageBefore = runReadOnlyGit(worktree, ["ls-files", "--stage", "-z", "--", ...paths]).stdout
    const bytesBefore = ownedStateHash(worktree, paths)
    const diff = runReadOnlyGit(baseline, ["diff", "--no-index", "--no-renames", "--numstat", "-z", "--", join(baseline, "before"), join(baseline, "after")])
    assert.equal(diff.status, 1)
    const counts = parseNumstat(diff.stdout, baseline, join(baseline, "before"), join(baseline, "after"), paths)
    assert.deepEqual(counts, {
      created: { additions: 1, deletions: 0 },
      deleted: { additions: 0, deletions: 1 },
      "space name": { additions: 1, deletions: 0 },
      staged: { additions: 1, deletions: 0 },
      tracked: { additions: 1, deletions: 0 },
      unstaged: { additions: 1, deletions: 0 },
      untracked: { additions: 1, deletions: 0 },
    })
    assert.equal(ownedStateHash(worktree, paths), bytesBefore)
    assert.deepEqual(runReadOnlyGit(worktree, ["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", ...paths]).stdout, statusBefore)
    assert.deepEqual(runReadOnlyGit(worktree, ["ls-files", "--stage", "-z", "--", ...paths]).stdout, stageBefore)
    const verifier = independentVerify(worktree, baseline, paths, before.hash)
    assert.deepEqual(verifier.counts, counts)
    assert.match(before.hash, /^[0-9a-f]{64}$/)
    assert.match(after.hash, /^[0-9a-f]{64}$/)
    assert.match(verifier.hash, /^[0-9a-f]{64}$/)

    assert.throws(() => validateOwnedManifest(worktree, Buffer.from("../escape\0")), /escapes/)
    assert.throws(() => validateOwnedManifest(worktree, Buffer.from(`${resolve(worktree, "tracked")}\0`)), /escapes/)
    assert.throws(() => validateOwnedManifest(worktree, Buffer.from("tracked\0tracked\0")), /duplicate/)
    symlinkSync("tracked", join(worktree, "link"))
    assert.throws(() => validateOwnedManifest(worktree, Buffer.from("link\0")), /symlink/)
    assert.throws(() => parseNumstat(Buffer.from(`-\t-\t${join(baseline, "before", "tracked")}\0`), baseline, join(baseline, "before"), join(baseline, "after"), paths), /binary/)
    assert.throws(() => parseNumstat(Buffer.from(`1\t0\t${join(baseline, "before", "not-owned")}\0`), baseline, join(baseline, "before"), join(baseline, "after"), paths), /unowned/)
    for (const args of [["add", "tracked"], ["diff", "--numstat", "HEAD"], ["status", "--short"]]) assert.throws(() => runReadOnlyGit(worktree, args), /allowlist/)
    const source = readFileSync(import.meta.filename, "utf8")
    assert.doesNotMatch(source, /import\s*\{[\s\S]*?\bexec\b[\s\S]*?\}\s*from\s*["']node:child_process["']/)
    assert.doesNotMatch(source, /shell\s*:\s*true/)
    const runnerSource = source.slice(source.indexOf("function runReadOnlyGit"), source.indexOf("function validateOwnedManifest"))
    assert.doesNotMatch(runnerSource, /`|\$\{/)
  } finally {
    rmSync(worktree, { recursive: true, force: true })
    rmSync(baseline, { recursive: true, force: true })
    assert.equal(existsSync(worktree), false)
    assert.equal(existsSync(baseline), false)
  }
  const activeContainers = new Set<string>()
  const stages = ["snapshot", "diff", "verifier", "spawn", "readiness", "scenario"] as const
  for (const stage of stages) {
    let baseline = "", container = ""
    assert.throws(() => {
      baseline = mkdtempSync(join(tmpdir(), "opencode", `actravel-mi-dia-${stage}-`))
      container = `mi-dia-${stage}`
      activeContainers.add(container)
      try {
        if (stage === "spawn") {
          runReadOnlyGit(baseline, ["rev-parse", "--show-toplevel"], () => ({ status: null, stdout: null, stderr: null, error: new Error("injected spawn failure") }))
        }
        throw new Error(`injected ${stage} failure`)
      } finally {
        activeContainers.delete(container)
        rmSync(baseline, { recursive: true, force: true })
      }
    }, /injected/)
    assert.equal(existsSync(baseline), false, stage)
    assert.equal(activeContainers.has(container), false, stage)
  }
  assert.equal(activeContainers.size, 0)
})
