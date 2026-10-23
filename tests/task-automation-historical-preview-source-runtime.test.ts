import assert from "node:assert/strict"
import test from "node:test"
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime"

const enabled = process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS === "1"
const uuid = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const parse = (value: string) => JSON.parse(value.split(/\r?\n/).at(-1)!)

test("0081 reconstructs bounded historical source joins and fails closed", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_source", admin = uuid(1, 91), owner = uuid(1, 92)
  const contact = uuid(2, 91), status = uuid(3, 91), lead = uuid(4, 91), quote = uuid(5, 91), version = uuid(6, 91)
  const assignment = uuid(7, 91), sent = uuid(7, 92), response = uuid(7, 93), exactPayment = uuid(8, 91), broadPayment = uuid(8, 92)
  const boundary = `public.read_task_automation_historical_boundaries('${admin}')`
  const source = (value = boundary) => parse(psql(database, `${actorSession(admin)} select public.read_task_automation_historical_sources('${admin}',${value})::text;`))
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage])
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name)
    psql(database, `
      insert into auth.users(id,email) values ('${admin}','admin@test'),('${owner}','owner@test');
      insert into public.profiles(id,full_name,is_active) values ('${admin}','Admin',true),('${owner}','Owner',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${admin}'::uuid,'admin'),('${owner}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;
      insert into public.contacts(id,first_name,email) values ('${contact}','Historical','historical@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','historical_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to,created_at) values ('${lead}','${contact}','${status}','${owner}','2026-01-02 12:00:00+00');
      insert into public.lead_events(id,lead_id,event_type,payload,created_at) values ('${assignment}','${lead}','assigned','{"assignedTo":"${owner}"}','2026-01-02 12:01:00+00');
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote}','${contact}','${lead}','Historical','${owner}','${owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${version}','${lead}','${contact}',1,'Historical','MXN','sent','${quote}','2026-01-02 12:02:00+00');
      insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,created_at) values
        ('${sent}','${quote}','${version}','${contact}','${lead}','${owner}','quote_sent','2026-01-02 12:02:00+00'),
        ('${response}','${quote}','${version}','${contact}','${lead}','${owner}','quote_version_response','2026-01-02 12:03:00+00');
      alter table public.payments disable trigger enforce_payment_quote_traceability;
      insert into public.payments(id,lead_id,contact_id,amount,status,accepted_quote_version_id,verified_at) values
        ('${exactPayment}','${lead}','${contact}',100,'verified','${version}','2026-01-02 12:04:00+00'),
        ('${broadPayment}','${lead}','${contact}',100,'verified',null,'2026-01-02 12:05:00+00');
      alter table public.payments enable trigger enforce_payment_quote_traceability;
    `)
    applyMigration(database, "0080_task_automation_sources.sql"); applyMigration(database, "0081_task_automation_historical_preview_boundary.sql")
    const origin = psql(database, `select public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact','${lead}'));`)
    const sourceKey = psql(database, `select public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','opportunity_assignment','${lead}','${owner}','2026-01-02T12:01:00.000000Z'));`)
    psql(database, `select public.task_automation_project('opportunity_assignment','${lead}','${sourceKey}',1,'generate','${origin}','first_contact','${owner}','${lead}',null,null,null,'2026-01-02 12:01:00+00',public.task_automation_due_at('first_contact','2026-01-02 12:01:00+00','mx-calendar.v1'),'mx-calendar.v1');`)
    const responseKey = psql(database, `select public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','quote_version_response','${version}','${response}'));`)
    psql(database, `select public.task_automation_cancel_quote_follow_up('quote_version_response','${response}','${responseKey}','${version}');`)

    const result = source()
    assert.equal(result.ok, true)
    assert.deepEqual(Object.keys(result).sort(), ["assignment_evidence", "automation_origins", "automation_outcomes", "automation_tombstones", "ok", "opportunity_facts", "owner_facts", "quote_facts", "quote_source_evidence", "task_occupancy"])
    assert.deepEqual(result.assignment_evidence.map((row: { event_id: string }) => row.event_id), [assignment])
    assert.deepEqual(result.quote_source_evidence.map((row: { evidence_id: string }) => row.evidence_id), [sent, response, exactPayment, broadPayment])
    assert.equal(result.quote_source_evidence[3].accepted_quote_version_id, null)
    assert.equal(result.assignment_evidence[0].payload_valid, true); assert.equal(result.quote_source_evidence[1].kind, "quote_version_response")
    assert.equal(result.opportunity_facts[0].assigned_to, owner); assert.equal(result.opportunity_facts[0].status_id, status)
    assert.equal(result.quote_facts[0].owner_id, owner); assert.equal(result.quote_facts[0].version_status, "sent")
    assert.equal(result.owner_facts[0].roles[0], "asesor")
    assert.equal(result.task_occupancy.length, 1); assert.equal(result.automation_origins.length, 1)
    assert.equal(result.automation_outcomes.length, 2); assert.equal(result.automation_tombstones.length, 1)
    assert.deepEqual(source(`jsonb_set(${boundary},'{opportunity_root_count}','0')`), { ok: false, error: { code: "INCOMPLETE_JOIN", message: "INCOMPLETE_JOIN" } })
    assert.deepEqual(source(`'{}'::jsonb`), { ok: false, error: { code: "MALFORMED_ROW", message: "MALFORMED_ROW" } })
    psql(database, `insert into public.lead_events(id,lead_id,event_type,created_at) values ('${sent}','${lead}','whatsapp_inbound_received','2026-01-02 12:04:00+00');`)
    assert.deepEqual(source(), { ok: false, error: { code: "MALFORMED_ROW", message: "MALFORMED_ROW" } })
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "")
  }
})
