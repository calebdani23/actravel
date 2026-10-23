import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0079_task_automation_foundation.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const payload = {
  schema: "mx-calendar.v1", zone: "America/Mexico_City", tzdb: "2024a", valid: ["2026-01-01", "2031-12-31"],
  offsetSeconds: -21600, weekdays: [1, 2, 3, 4, 5], hours: ["09:00", "18:00"],
  holidays: ["01-01", "firstMonFeb", "thirdMonMar", "05-01", "firstSunJun:y%6=2", "09-16", "10-01:y%6=2", "thirdMonNov", "12-25"],
};
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const ruleHash = createHash("sha256").update(canonical(["task-due-calendar.v1", payload])).digest("hex");

function due(database: string, kind: string, anchor: string, version: string) {
  return psql(database, `select to_char(public.task_automation_due_at('${kind}','${anchor}','${version}') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');`);
}

test("0079 seals the exact host-independent Mexico City calendar and due types", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const types = readFileSync("lib/supabase/database.types.ts", "utf8");
  assert.match(sql, /create table public\.task_due_calendar_rules[\s\S]*rule_version text primary key[\s\S]*payload jsonb[\s\S]*rule_hash text/i);
  for (const value of Object.values(payload).flat()) assert.ok(sql.includes(String(value)), String(value));
  assert.match(sql, /'task-due-calendar\.v1'[\s\S]*follow_up_canonical_json[\s\S]*sha256/i);
  assert.match(sql, /prevent_task_due_calendar_rule_change[\s\S]*before update or delete/i);
  assert.match(sql, /task_automation_due_at\(p_task_kind text,p_anchor_at timestamptz,p_due_rule_version text\)/i);
  assert.doesNotMatch(sql, /at time zone\s+'America\/Mexico_City'/i);
  assert.doesNotMatch(sql, /task_automation_tombstones|0080_task_automation_sources|create trigger[^;]+(leads|quote_versions)/i);
  assert.match(types, /task_due_calendar_rules: \{[\s\S]*Row: \{[\s\S]*created_at: string[\s\S]*payload: Json[\s\S]*rule_hash: string[\s\S]*rule_version: string/);
});

test("calendar projection is deterministic, version-bound, immutable, and closed outside support", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_calendar";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);

    const stored = JSON.parse(psql(database, "select jsonb_build_object('version',rule_version,'payload',payload,'hash',rule_hash)::text from public.task_due_calendar_rules;"));
    assert.deepEqual(stored, { hash: ruleHash, payload, version: "mx-calendar.v1" });
    assert.throws(() => psql(database, "update public.task_due_calendar_rules set rule_hash=repeat('0',64);"), /TASK_DUE_CALENDAR_IMMUTABLE/);
    assert.throws(() => psql(database, "delete from public.task_due_calendar_rules;"), /TASK_DUE_CALENDAR_IMMUTABLE/);
    assert.equal(psql(database, "select array[has_function_privilege('authenticated','public.task_automation_due_at(text,timestamptz,text)','execute'),has_function_privilege('service_role','public.task_automation_due_at(text,timestamptz,text)','execute')]::text;"), "{f,f}");

    assert.equal(due(database, "first_contact", "2026-09-21 16:00:00.123456+00", "mx-calendar.v1"), "2026-09-21T16:15:00.123456Z");
    assert.equal(due(database, "first_contact", "2026-01-31 00:00:00+00", "mx-calendar.v1"), "2026-02-03T15:15:00.000000Z");
    assert.equal(due(database, "first_contact", "2030-10-01 16:00:00+00", "mx-calendar.v1"), "2030-10-02T15:15:00.000000Z");
    assert.equal(due(database, "quote_follow_up", "2026-09-21 15:00:00.123456+00", "elapsed-48h.v1"), "2026-09-23T15:00:00.123456Z");
    assert.equal(psql(database, "set timezone='Pacific/Chatham'; select to_char(public.task_automation_due_at('first_contact','2026-09-21 16:00:00.123456+00','mx-calendar.v1') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"');"), "2026-09-21T16:15:00.123456Z");

    for (const [kind, anchor, version] of [
      ["first_contact", "2025-12-31Z", "mx-calendar.v1"], ["first_contact", "2032-01-01Z", "mx-calendar.v1"],
      ["first_contact", "2026-09-21Z", "elapsed-48h.v1"], ["quote_follow_up", "2026-09-21Z", "mx-calendar.v1"],
    ]) assert.throws(() => due(database, kind, anchor, version), /TASK_DUE_UNSUPPORTED/);
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
