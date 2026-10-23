import { execFile, execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const migrationDirectory = "db/migrations";
const postgresCommandTimeoutMs = 120_000;
let containerSequence = 0;

export function uniquePostgresContainerName(label: string) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  if (!safeLabel) throw new Error("PostgreSQL container label is invalid");
  containerSequence += 1;
  return `actravel-${safeLabel}-${process.pid}-${containerSequence}`;
}

export const containerName = uniquePostgresContainerName("quote-registration");
export const postgresImage = process.env.QUOTE_REGISTRATION_POSTGRES_IMAGE ?? "postgres:16-alpine";

export function docker(args: string[], input?: string) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    input,
    timeout: postgresCommandTimeoutMs,
    killSignal: "SIGKILL",
    stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
  }).trim();
}

type DockerInvoke = (args: string[], options: { timeoutMs: number }) => Promise<string>;

async function dockerAsync(args: string[], options: { timeoutMs: number }) {
  const result = await execFileAsync("docker", args, {
    encoding: "utf8",
    timeout: options.timeoutMs,
    killSignal: "SIGKILL",
  });
  return result.stdout.trim();
}

export function psql(database: string, source: string) {
  return docker([
    "exec", "-i", containerName, "psql", "-X", "-qAt",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
  ], `set search_path = public, extensions;\n${source}\n`);
}

export async function psqlAsync(database: string, source: string) {
  const result = await execFileAsync("docker", [
    "exec", "-i", containerName, "psql", "-X", "-qAt",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
    "-c", `set search_path = public, extensions;\n${source}\n`,
  ], {
    encoding: "utf8",
    timeout: postgresCommandTimeoutMs,
    killSignal: "SIGKILL",
  });
  return result.stdout.trim();
}

export function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function actorSession(actorId: string, role = "authenticated") {
  return `
    select set_config('request.jwt.claim.sub', ${sqlLiteral(actorId)}, false);
    select set_config('request.jwt.claim.role', ${sqlLiteral(role)}, false);
    set role ${role};
  `;
}

export function serviceSession() {
  return `
    select set_config('request.jwt.claim.sub', '', false);
    select set_config('request.jwt.claim.role', 'service_role', false);
    set role service_role;
  `;
}

const bootstrap = `
  do $bootstrap$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end
  $bootstrap$;
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
  create table if not exists auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz not null default now()
  );
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = ''
  as $auth$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $auth$;
  create or replace function auth.role()
  returns text
  language sql
  stable
  set search_path = ''
  as $auth$ select nullif(current_setting('request.jwt.claim.role', true), '') $auth$;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default extensions.gen_random_uuid(),
    bucket_id text not null references storage.buckets(id) on delete cascade,
    name text not null,
    owner_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_accessed_at timestamptz not null default now(),
    constraint objects_bucket_name_key unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create or replace function storage.extension(name text)
  returns text
  language sql
  immutable
  set search_path = ''
  as $storage$ select substring(name from '\\.([^.]*)$') $storage$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.role(), storage.extension(text) to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, service_role;
`;

export function migrationNames() {
  return readdirSync(migrationDirectory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

export function applyMigration(database: string, name: string) {
  psql(database, readFileSync(`${migrationDirectory}/${name}`, "utf8"));
}

export function prepareBaseDatabase() {
  psql("postgres", "create database quote_base;");
  psql("quote_base", bootstrap);
  for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) <= 56)) applyMigration("quote_base", name);
}

type PostgresWaitOptions = {
  containerName?: string;
  commandTimeoutMs?: number;
  readinessAttempts?: number;
  readinessDelayMs?: number;
  invoke?: DockerInvoke;
  sleep?: (milliseconds: number) => Promise<void>;
};

const boundedInteger = (value: number | undefined, fallback: number, maximum: number) =>
  Number.isInteger(value) && value! > 0 && value! <= maximum ? value! : fallback;

export async function waitForPostgres(options: PostgresWaitOptions = {}) {
  const name = options.containerName ?? containerName;
  const invoke = options.invoke ?? dockerAsync;
  const timeoutMs = boundedInteger(options.commandTimeoutMs, postgresCommandTimeoutMs, postgresCommandTimeoutMs);
  const attempts = boundedInteger(options.readinessAttempts, 60, 60);
  const delayMs = options.readinessDelayMs === 0 ? 0 : boundedInteger(options.readinessDelayMs, 250, 1_000);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let ready = false;
  let consecutiveReadyChecks = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await invoke(["exec", name, "pg_isready", "-U", "postgres"], { timeoutMs });
      await invoke(["exec", name, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-c", "select 1"], { timeoutMs });
      consecutiveReadyChecks += 1;
      if (consecutiveReadyChecks >= 3) {
        ready = true;
        break;
      }
    } catch {
      consecutiveReadyChecks = 0;
    }
    if (attempt + 1 < attempts) await sleep(delayMs);
  }
  if (!ready) throw new Error("PostgreSQL container did not become ready");
}

type PostgresContainerOptions = PostgresWaitOptions & {
  image?: string;
};

export async function withPostgresContainer<T>(
  scenario: (runtime: { psql(database: string, source: string): Promise<string> }) => Promise<T>,
  options: PostgresContainerOptions = {},
) {
  const name = options.containerName ?? containerName;
  const image = options.image ?? postgresImage;
  const invoke = options.invoke ?? dockerAsync;
  const timeoutMs = boundedInteger(options.commandTimeoutMs, postgresCommandTimeoutMs, postgresCommandTimeoutMs);
  // Keep the legacy name for psql()/prepareBaseDatabase() callers, but never
  // infer ownership from it: a failed run can collide with another test.
  const ownerLabel = `actravel.test.owner=${randomUUID()}`;
  const ownedContainers = () => invoke(["ps", "-aq", "--filter", `label=${ownerLabel}`], { timeoutMs });
  try {
    await invoke(["run", "--rm", "-d", "--name", name, "--label", ownerLabel, "-e", "POSTGRES_PASSWORD=postgres", image], { timeoutMs });
    await waitForPostgres({ ...options, containerName: name, commandTimeoutMs: timeoutMs, invoke });
    return await scenario({
      psql: async (database, source) => (await invoke([
        "exec", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
        "-c", `set search_path = public, extensions;\n${source}\n`,
      ], { timeoutMs })).trim(),
    });
  } finally {
    // Query even after a startup timeout: Docker may have created the container
    // before the CLI was interrupted. Only this invocation's label is eligible.
    for (const id of (await ownedContainers()).split(/\s+/).filter(Boolean)) {
      if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error("Invalid owned PostgreSQL container ID");
      try {
        await invoke(["rm", "-f", id], { timeoutMs });
      } catch {
        // The --rm container may already have exited and removed itself.
      }
    }
    const remaining = await ownedContainers();
    if (remaining.trim()) throw new Error(`PostgreSQL container cleanup failed: ${name}`);
  }
}

export function cleanupPostgres() {
  try {
    docker(["rm", "-f", containerName]);
  } catch {
    // The --rm container may already have exited and removed itself.
  }
}
