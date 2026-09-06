import { execFile, execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const migrationDirectory = "db/migrations";
export const containerName = `actravel-quote-registration-${process.pid}`;
export const postgresImage = process.env.QUOTE_REGISTRATION_POSTGRES_IMAGE ?? "postgres:16-alpine";

export function docker(args: string[], input?: string) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    input,
    stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
  }).trim();
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

export async function waitForPostgres() {
  let ready = false;
  let consecutiveReadyChecks = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      docker(["exec", containerName, "pg_isready", "-U", "postgres"]);
      docker(["exec", containerName, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-c", "select 1"]);
      consecutiveReadyChecks += 1;
      if (consecutiveReadyChecks >= 3) {
        ready = true;
        break;
      }
    } catch {
      consecutiveReadyChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("PostgreSQL container did not become ready");
}

export function cleanupPostgres() {
  try {
    docker(["rm", "-f", containerName]);
  } catch {
    // The --rm container may already have exited and removed itself.
  }
}
